const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function esTasaValida(valor) {
  return typeof valor === 'number' && !isNaN(valor) && valor > 0.01 && valor < 10000;
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
    timeout: 25000
  });

  return cheerio.load(response.data);
}

// Obtener archivo de GitHub para fallback
async function cargarTasaAnteriorGitHub(repo, token) {
  try {
    const url = `https://api.github.com/repos/${repo}/contents/tasa.json`;
    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Cron-BCV'
      }
    });
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return {
      data: JSON.parse(content),
      sha: res.data.sha
    };
  } catch (e) {
    console.error('Error al obtener tasa anterior de GitHub:', e.message);
    return null;
  }
}

// Guardar archivo en GitHub
async function guardarTasaGitHub(repo, token, sha, resultado) {
  const url = `https://api.github.com/repos/${repo}/contents/tasa.json`;
  const contentBase64 = Buffer.from(JSON.stringify(resultado, null, 2)).toString('base64');
  
  await axios.put(url, {
    message: `Actualización automática (Vercel Cron): Tasa BCV ${new Date().toISOString()}`,
    content: contentBase64,
    sha: sha
  }, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Vercel-Cron-BCV'
    }
  });
}

module.exports = async (req, res) => {
  // 1. Verificar autorización de Cron de Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const repo = process.env.GH_REPO; // ej. "MiUsuario/MiRepo"
  const token = process.env.GH_TOKEN; // GitHub Personal Access Token con permisos de contenido (contents: write)

  if (!repo || !token) {
    return res.status(500).json({ error: 'Faltan variables de entorno GH_REPO o GH_TOKEN' });
  }

  // Cargar tasa anterior y su SHA para poder hacer commit
  const anteriorObj = await cargarTasaAnteriorGitHub(repo, token);
  const anterior = anteriorObj ? anteriorObj.data : null;
  const sha = anteriorObj ? anteriorObj.sha : null;

  // Lógica de scraping
  let $ = null;
  for (let intento = 1; intento <= MAX_RETRIES; intento++) {
    try {
      $ = await intentarScrape();
      break;
    } catch (error) {
      console.error(`Intento ${intento} falló: ${error.message}`);
      if (intento < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
      }
    }
  }

  // Fallback si falla el scraper por completo
  if (!$) {
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      const fallbackResultado = {
        ...anterior,
        stale: true,
        updated_at: new Date().toISOString()
      };
      await guardarTasaGitHub(repo, token, sha, fallbackResultado);
      return res.status(200).json({ success: true, message: 'Fallo scraping, se usó tasa anterior (stale)', data: fallbackResultado });
    } else {
      return res.status(500).json({ error: 'No se pudo obtener la tasa y no hay datos anteriores' });
    }
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
  }
  if (eur !== null && esTasaValida(eur)) {
    resultado.bcv.eur = eur;
  }

  // Si no se obtuvo ninguna moneda válida, usar anterior completa
  if (Object.keys(resultado.bcv).length === 0) {
    if (anterior?.bcv && (anterior.bcv.usd || anterior.bcv.eur)) {
      resultado.bcv = anterior.bcv;
      resultado.stale = true;
    } else {
      return res.status(500).json({ error: 'Monedas inválidas y sin tasa anterior' });
    }
  }

  // Si falta alguna de las monedas, completar con la anterior
  if (resultado.stale !== true && anterior?.bcv) {
    if (!resultado.bcv.usd && anterior.bcv.usd) {
      resultado.bcv.usd = anterior.bcv.usd;
    }
    if (!resultado.bcv.eur && anterior.bcv.eur) {
      resultado.bcv.eur = anterior.bcv.eur;
    }
  }

  // Guardar en GitHub si hubo cambios o si no hay más remedio
  // Comparamos si cambió para evitar commits innecesarios
  const cambioUSD = anterior?.bcv?.usd !== resultado.bcv.usd;
  const cambioEUR = anterior?.bcv?.eur !== resultado.bcv.eur;
  const cambioStale = anterior?.stale !== resultado.stale;

  if (cambioUSD || cambioEUR || cambioStale || !anterior) {
    await guardarTasaGitHub(repo, token, sha, resultado);
    return res.status(200).json({ success: true, message: 'Tasa actualizada y commiteada', data: resultado });
  }

  return res.status(200).json({ success: true, message: 'La tasa no ha cambiado', data: resultado });
};
