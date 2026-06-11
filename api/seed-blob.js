const { put } = require('@vercel/blob');
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const fallback = process.env.FALLBACK_RAW_URL;
    if (!fallback) return res.status(400).json({ error: 'No FALLBACK_RAW_URL' });

    const response = await axios.get(fallback, { timeout: 5000 });
    const data = response.data;

    await put('tasa.json', JSON.stringify(data, null, 2), {
      access: 'public',
      addRandomSuffix: false
    });

    return res.status(200).json({ success: true, message: 'Blob inicializado', data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
