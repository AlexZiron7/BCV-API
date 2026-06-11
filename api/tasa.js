const { get } = require('@vercel/blob');
const axios = require('axios');

const BLOB_PATH = 'tasa.json';
const FALLBACK_URL = process.env.FALLBACK_RAW_URL;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const blob = await get(BLOB_PATH, { access: 'private' });
    if (blob) {
      const text = await blob.text();
      const data = JSON.parse(text);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=120');
      res.setHeader('X-Cache-Source', 'vercel-blob');
      return res.status(200).json(data);
    }
  } catch (e) {
    console.error('Error al leer de Blob:', e.message, e.stack?.substring(0, 500));
  }

  if (FALLBACK_URL) {
    try {
      const response = await axios.get(FALLBACK_URL, { timeout: 5000 });
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=120');
      res.setHeader('X-Cache-Source', 'github-raw');
      return res.status(200).json(response.data);
    } catch (e) {
      console.error('Fallback a GitHub RAW falló:', e.message);
    }
  }

  res.setHeader('Cache-Control', 'no-cache');
  return res.status(503).json({ error: 'No hay datos disponibles' });
};
