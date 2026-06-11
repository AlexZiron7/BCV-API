const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  const data = {
    bcv: { usd: 577.5461, eur: 667.37184493 },
    updated_at: new Date().toISOString(),
    stale: false
  };
  try {
    await put('tasa.json', JSON.stringify(data, null, 2), {
      access: 'private', addRandomSuffix: false, allowOverwrite: true
    });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
