const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');

async function obtenerTasaBCV() {
  try {
    // 1. Configurar agente para ignorar problemas de certificado SSL del BCV
    const agent = new https.Agent({ rejectUnauthorized: false });

    // 2. Hacer la petición simulando un navegador real
    const response = await axios.get('https://www.bcv.org.ve/', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
      },
      timeout: 30000 // 30 segundos de margen de espera
    });

    const $ = cheerio.load(response.data);

    // 3. Extraer los valores limpiando los espacios y cambiando comas por puntos
    const usdTexto = $('#dolar strong').text().trim().replace(',', '.');
    const eurTexto = $('#euro strong').text().trim().replace(',', '.');

    if (!usdTexto || !eurTexto) {
      throw new Error('No se pudieron encontrar los contenedores numéricos en el HTML.');
    }

    const usd = parseFloat(usdTexto);
    const eur = parseFloat(eurTexto);

    // 4. Estructurar el objeto JSON
    const resultado = {
      bcv: {
        usd: usd,
        eur: eur
      },
      updated_at: new Date().toISOString()
    };

    // 5. Guardar el archivo localmente
    fs.writeFileSync('tasa.json', JSON.stringify(resultado, null, 2));
    console.log('JSON generado con éxito:', resultado);

  } catch (error) {
    console.error('Error al scrapear el BCV:', error.message);
    process.exit(1); // Forzar fallo para que GitHub Actions lo notifique
  }
}

obtenerTasaBCV();
