const { put, get } = require('@vercel/blob');
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const fallback = process.env.FALLBACK_RAW_URL;

    if (req.query.test === 'get') {
      try {
        const blob = await get('tasa.json', { access: 'private' });
        return res.json({ exists: !!blob, type: typeof blob });
      } catch (e) {
        return res.status(500).json({ error: 'get failed: ' + e.message, stack: e.stack?.substring(0, 300) });
      }
    }

    if (!fallback) return res.status(400).json({ error: 'No FALLBACK_RAW_URL' });

    const response = await axios.get(fallback, { timeout: 5000 });
    const data = response.data;

    const result = await put('tasa.json', JSON.stringify(data, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    return res.status(200).json({ success: true, message: 'Blob inicializado', url: result.url, data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
