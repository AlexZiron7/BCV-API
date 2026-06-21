const { get, list } = require('@vercel/blob');

const BLOB_PATH = 'tasa.json';

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

function estimarProximaActualizacion() {
  const ahora = new Date();
  const proxima = new Date(ahora);
  proxima.setUTCHours(14, 30, 0, 0);
  if (ahora.getUTCHours() >= 14 || (ahora.getUTCHours() === 14 && ahora.getUTCMinutes() >= 30)) {
    proxima.setUTCDate(proxima.getUTCDate() + 1);
  }
  return proxima.toISOString();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

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
          const horasDesdeActualizacion = updatedAt ? (Date.now() - updatedAt.getTime()) / 36e5 : null;

          return res.status(200).json({
            status: data.stale ? 'stale' : 'ok',
            tasa: data.bcv,
            ultima_actualizacion: data.updated_at,
            horas_desde_actualizacion: horasDesdeActualizacion ? Math.round(horasDesdeActualizacion * 10) / 10 : null,
            proxima_actualizacion_estimada: estimarProximaActualizacion(),
            stale: data.stale || false
          });
        }
      }
    }

    return res.status(200).json({
      status: 'error',
      tasa: null,
      ultima_actualizacion: null,
      horas_desde_actualizacion: null,
      proxima_actualizacion_estimada: estimarProximaActualizacion(),
      stale: true
    });
  } catch (e) {
    console.error('Health check error:', e.message);
    return res.status(500).json({
      status: 'error',
      tasa: null,
      ultima_actualizacion: null,
      horas_desde_actualizacion: null,
      proxima_actualizacion_estimada: estimarProximaActualizacion(),
      stale: true
    });
  }
};
