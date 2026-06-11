const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function esTasaValida(valor) {
  return typeof valor === 'number' && !isNaN(valor) && valor > 0.01 && valor < 10000;
}

function extraerValor($, selector) {
  const texto = $(selector).text().trim().replace(/\s+/g, '').replace(',', '.');
  return texto ? parseFloat(texto) : null;
}

async function intentarScrape(timeout = 30000) {
  const agent = new https.Agent({ rejectUnauthorized: true });

  try {
    const response = await axios.get('https://www.bcv.org.ve/', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
      },
      timeout
    });

    return cheerio.load(response.data);
  } catch (error) {
    if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.message?.includes('certificate')) {
      console.warn('Error de certificado SSL, reintentando con validación deshabilitada...');
      const fallbackAgent = new https.Agent({ rejectUnauthorized: false });
      const response = await axios.get('https://www.bcv.org.ve/', {
        httpsAgent: fallbackAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        },
        timeout
      });
      return cheerio.load(response.data);
    }
    throw error;
  }
}

function cargarTasaAnterior(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.warn('No se pudo leer tasa anterior:', e.message);
  }
  return null;
}

async function notificarTelegram(mensaje) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram no configurado (faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
    return;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `⚠️ *BCV-API:* ${mensaje}`,
      parse_mode: 'Markdown'
    });
    console.log('Notificación Telegram enviada');
  } catch (e) {
    console.error('Error al enviar notificación Telegram:', e.message);
  }
}

async function procesarOpcionesManuales({ manualUSD, manualEUR, anterior }) {
  const resultado = {
    bcv: {},
    updated_at: new Date().toISOString(),
    stale: false
  };

  if (manualUSD) {
    const usd = parseFloat(manualUSD);
    if (esTasaValida(usd)) {
      resultado.bcv.usd = usd;
      console.log('USD inyectado manualmente:', usd);
    } else {
      console.error('USD manual inválido:', manualUSD);
      if (anterior?.bcv?.usd) resultado.bcv.usd = anterior.bcv.usd;
    }
  }

  if (manualEUR) {
    const eur = parseFloat(manualEUR);
    if (esTasaValida(eur)) {
      resultado.bcv.eur = eur;
      console.log('EUR inyectado manualmente:', eur);
    } else {
      console.error('EUR manual inválido:', manualEUR);
      if (anterior?.bcv?.eur) resultado.bcv.eur = anterior.bcv.eur;
    }
  }

  if (Object.keys(resultado.bcv).length === 0) {
    return { error: 'No se pudo generar JSON con valores manuales.' };
  }

  return resultado;
}

async function obtenerTasaBCV({ anterior = null, manualUSD = null, manualEUR = null, timeout = 30000 } = {}) {
  if (manualUSD || manualEUR) {
    const manual = await procesarOpcionesManuales({ manualUSD, manualEUR, anterior });
    return manual;
  }

  let $ = null;

  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
    try {
      console.log(`Intento ${intento}/${MAX_RETRIES} - Scrapeando BCV...`);
      $ = await intentarScrape(timeout);
      console.log('Página descargada correctamente');
      break;
    } catch (error) {
      console.error(`Intento ${intento} falló: ${error.message}`);
      if (intento < MAX_RETRIES) {
        console.log(`Esperando ${RETRY_DELAY / 1000}s antes de reintentar...`);
        await sleep(RETRY_DELAY);
      }
    }
  }

  if (!$) {
    console.error('No se pudo obtener la página del BCV tras', MAX_RETRIES, 'intentos.');
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      const stale = {
        ...anterior,
        stale: true,
        updated_at: new Date().toISOString()
      };
      console.log('Usando tasa anterior (stale).');
      await notificarTelegram(
        `Scraping falló tras ${MAX_RETRIES} intentos. Usando tasa anterior (stale).`
      );
      return stale;
    }
    return { error: 'No hay tasa anterior disponible. No se puede generar JSON.' };
  }

  const resultado = {
    bcv: {},
    updated_at: new Date().toISOString(),
    stale: false
  };

  const usd = extraerValor($, '#dolar strong');
  const eur = extraerValor($, '#euro strong');

  if (usd !== null && esTasaValida(usd)) {
    resultado.bcv.usd = usd;
    console.log('USD:', usd);
  } else {
    console.error('USD inválido o no encontrado:', usd);
  }

  if (eur !== null && esTasaValida(eur)) {
    resultado.bcv.eur = eur;
    console.log('EUR:', eur);
  } else {
    console.error('EUR inválido o no encontrado:', eur);
  }

  if (Object.keys(resultado.bcv).length === 0) {
    console.error('No se obtuvo ninguna moneda válida.');
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      resultado.bcv = anterior.bcv;
      resultado.stale = true;
      console.log('Usando tasa anterior (stale).');
      await notificarTelegram(
        'No se obtuvieron monedas válidas del BCV. Usando tasa anterior (stale).'
      );
    } else {
      return { error: 'No hay tasa anterior disponible.' };
    }
  }

  if (resultado.stale !== true && anterior?.bcv) {
    if (!resultado.bcv.usd && anterior.bcv.usd) {
      resultado.bcv.usd = anterior.bcv.usd;
      console.log('USD completado con valor anterior:', anterior.bcv.usd);
    }
    if (!resultado.bcv.eur && anterior.bcv.eur) {
      resultado.bcv.eur = anterior.bcv.eur;
      console.log('EUR completado con valor anterior:', anterior.bcv.eur);
    }
  }

  return resultado;
}

module.exports = {
  sleep,
  esTasaValida,
  extraerValor,
  intentarScrape,
  cargarTasaAnterior,
  notificarTelegram,
  obtenerTasaBCV
};
