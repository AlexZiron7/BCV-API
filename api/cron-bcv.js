const { obtenerTasaBCV, streamToString } = require('../lib/scraper');
const { put, get, list } = require('@vercel/blob');

const BLOB_PATH = 'tasa.json';

async function cargarAnteriorDesdeBlob() {
  try {
    const { blobs } = await list({ limit: 10 });
    const tasaBlob = blobs.find(b => b.pathname === BLOB_PATH);
    if (tasaBlob) {
      const result = await get(tasaBlob.url, { access: 'private' });
      if (result?.stream) {
        const text = await streamToString(result.stream);
        return JSON.parse(text);
      }
    }
  } catch (e) {
    console.log('No hay tasa anterior en Blob o error al leer:', e.message);
  }
  return null;
}

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const anterior = await cargarAnteriorDesdeBlob();

  const resultado = await obtenerTasaBCV({
    anterior,
    timeout: 25000
  });

  if (resultado.error) {
    return res.status(500).json({ error: resultado.error });
  }

  try {
    await put(BLOB_PATH, JSON.stringify(resultado, null, 2), {
      access: 'private',
      addRandomSuffix: false
    });
    console.log('Tasa guardada en Vercel Blob:', resultado);
  } catch (e) {
    console.error('Error al guardar en Blob:', e.message);
    return res.status(500).json({ error: 'Error al guardar en Blob' });
  }

  const cambioUSD = anterior?.bcv?.usd !== resultado.bcv.usd;
  const cambioEUR = anterior?.bcv?.eur !== resultado.bcv.eur;
  const cambioStale = anterior?.stale !== resultado.stale;

  if (cambioUSD || cambioEUR || cambioStale || !anterior) {
    return res.status(200).json({ success: true, message: 'Tasa actualizada', data: resultado });
  }

  return res.status(200).json({ success: true, message: 'La tasa no ha cambiado', data: resultado });
};
