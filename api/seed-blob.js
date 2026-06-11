const { put, get, head } = require('@vercel/blob');
const axios = require('axios');

function hasMethod(obj, name) {
  return obj && typeof obj[name] === 'function';
}

module.exports = async (req, res) => {
  try {
    if (req.query.test === 'get') {
      try {
        const blob = await get('tasa.json', { access: 'private' });
        if (!blob) return res.json({ exists: false });
        return res.json({
          exists: true,
          type: typeof blob,
          hasText: hasMethod(blob, 'text'),
          hasJson: hasMethod(blob, 'json'),
          hasBody: hasMethod(blob, 'body'),
          constructor: blob.constructor?.name,
          keys: Object.keys(blob).slice(0, 10)
        });
      } catch (e) {
        return res.status(500).json({ error: e.constructor?.name + ': ' + e.message, stack: e.stack?.substring(0, 500) });
      }
    }

    if (req.query.test === 'gettext') {
      try {
        const blob = await get('tasa.json', { access: 'private' });
        const text = await blob.text();
        return res.json({ text: text?.substring(0, 200), length: text?.length });
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
