const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');

const OUTPUT_PATH = process.env.OUTPUT_PATH || 'tasa.json';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function esTasaValida(valor) {
  return typeof valor === 'number' && !isNaN(valor) && valor > 0.01 && valor < 10000;
}

function cargarTasaAnterior() {
  try {
    if (fs.existsSync(OUTPUT_PATH)) {
      return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('No se pudo leer tasa anterior:', e.message);
  }
  return null;
}

function extraerValor($, selector) {
  const texto = $(selector).text().trim().replace(/\s+/g, '').replace(',', '.');
  return texto ? parseFloat(texto) : null;
}

async function intentarScrape() {
  const agent = new https.Agent({ rejectUnauthorized: false });

  const response = await axios.get('https://www.bcv.org.ve/', {
    httpsAgent: agent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
    },
    timeout: 30000
  });

  return cheerio.load(response.data);
}

async function obtenerTasaBCV() {
  const manualUSD = process.env.MANUAL_USD;
  const manualEUR = process.env.MANUAL_EUR;

  if (manualUSD || manualEUR) {
    const anterior = cargarTasaAnterior();
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

    if (Object.keys(resultado.bcv).length > 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(resultado, null, 2));
      console.log('JSON generado con éxito (manual):', resultado);
    } else {
      console.error('No se pudo generar JSON con valores manuales.');
      process.exit(1);
    }
    return;
  }

  let $ = null;
  let ultimoError = null;

  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
    try {
      console.log(`Intento ${intento}/${MAX_RETRIES} - Scrapeando BCV...`);
      $ = await intentarScrape();
      console.log('Pagina descargada correctamente');
      break;
    } catch (error) {
      ultimoError = error;
      console.error(`Intento ${intento} fallo: ${error.message}`);
      if (intento < MAX_RETRIES) {
        console.log(`Esperando ${RETRY_DELAY / 1000}s antes de reintentar...`);
        await sleep(RETRY_DELAY);
      }
    }
  }

  if (!$) {
    console.error('No se pudo obtener la pagina del BCV tras', MAX_RETRIES, 'intentos.');
    const anterior = cargarTasaAnterior();
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      anterior.stale = true;
      anterior.updated_at = new Date().toISOString();
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(anterior, null, 2));
      console.log('Usando tasa anterior (stale). Notificacion enviada por GitHub.');
      console.log('Dato anterior:', anterior);
    } else {
      console.error('No hay tasa anterior disponible. No se puede generar JSON.');
      process.exit(1);
    }
    return;
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
    console.error('USD invalido o no encontrado:', usd);
  }

  if (eur !== null && esTasaValida(eur)) {
    resultado.bcv.eur = eur;
    console.log('EUR:', eur);
  } else {
    console.error('EUR invalido o no encontrado:', eur);
  }

  if (Object.keys(resultado.bcv).length === 0) {
    console.error('No se obtuvo ninguna moneda valida.');
    const anterior = cargarTasaAnterior();
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      resultado.bcv = anterior.bcv;
      resultado.stale = true;
      console.log('Usando tasa anterior (stale).');
    } else {
      console.error('No hay tasa anterior disponible.');
      process.exit(1);
    }
  }

  // Si falta alguna moneda, completar con la anterior
  if (resultado.stale !== true) {
    const anterior = cargarTasaAnterior();
    if (anterior?.bcv) {
      if (!resultado.bcv.usd && anterior.bcv.usd) {
        resultado.bcv.usd = anterior.bcv.usd;
        console.log('USD completado con valor anterior:', anterior.bcv.usd);
      }
      if (!resultado.bcv.eur && anterior.bcv.eur) {
        resultado.bcv.eur = anterior.bcv.eur;
        console.log('EUR completado con valor anterior:', anterior.bcv.eur);
      }
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(resultado, null, 2));
  console.log('JSON generado con exito:', resultado);
}

obtenerTasaBCV();
