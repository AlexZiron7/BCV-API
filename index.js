const { obtenerTasaBCV, cargarTasaAnterior } = require('./lib/scraper');

const OUTPUT_PATH = process.env.OUTPUT_PATH || 'tasa.json';

async function main() {
  const anterior = cargarTasaAnterior(OUTPUT_PATH);
  const manualUSD = process.env.MANUAL_USD;
  const manualEUR = process.env.MANUAL_EUR;

  const resultado = await obtenerTasaBCV({
    anterior,
    manualUSD,
    manualEUR
  });

  if (resultado.error) {
    console.error(resultado.error);
    process.exit(1);
  }

  require('fs').writeFileSync(OUTPUT_PATH, JSON.stringify(resultado, null, 2));
  console.log('JSON generado con éxito:', resultado);
}

main();
