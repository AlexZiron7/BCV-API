const { put, get, head, list } = require('@vercel/blob');
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    if (req.query.test === 'get') {
      try {
        const blob = await get('tasa.json', { access: 'private' });
        return res.json({
          exists: !!blob,
          keys: Object.keys(blob),
          statusCode: blob.statusCode,
          blobInfo: blob.blob,
          hasStream: !!blob.stream
        });
      } catch (e) {
        return res.status(500).json({ error: e.constructor?.name + ': ' + e.message });
      }
    }

    if (req.query.test === 'gettext') {
      try {
        const blob = await get('tasa.json', { access: 'private' });
        const reader = blob.stream.getReader();
        const decoder = new TextDecoder();
        let text = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        return res.json({ text: text?.substring(0, 300), length: text?.length });
      } catch (e) {
        return res.status(500).json({ error: e.constructor?.name + ': ' + e.message, stack: e.stack?.substring(0, 500) });
      }
    }

    const fallback = process.env.FALLBACK_RAW_URL;
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
