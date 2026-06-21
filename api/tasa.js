const { get, list } = require('@vercel/blob');
const axios = require('axios');

const BLOB_PATH = 'tasa.json';
const FALLBACK_URL = process.env.FALLBACK_RAW_URL;

async function streamToString(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { blobs } = await list({ limit: 10 });
    const tasaBlob = blobs.find(b => b.pathname === BLOB_PATH);
    if (tasaBlob) {
      const result = await get(tasaBlob.url, { access: 'private' });
      if (result && result.stream) {
        const text = await streamToString(result.stream);
        if (text) {
          const data = JSON.parse(text);
          const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
          const isStale = data.stale || !updatedAt || (Date.now() - updatedAt.getTime() > 16 * 60 * 60 * 1000);
          if (!isStale) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('X-Cache-Source', 'vercel-blob');
            return res.status(200).json(data);
          } else {
            console.log('Blob data is stale, falling back to GitHub raw URL...');
          }
        }
      }
    }
  } catch (e) {
    console.error('Blob error:', e.message);
  }

  if (FALLBACK_URL) {
    try {
      const response = await axios.get(FALLBACK_URL, { timeout: 5000 });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('X-Cache-Source', 'github-raw');
      return res.status(200).json(response.data);
    } catch (e) {
      console.error('Fallback error:', e.message);
    }
  }

  return res.status(503).json({ error: 'No hay datos disponibles' });
};
