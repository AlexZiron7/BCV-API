const { describe, it } = require('node:test');
const assert = require('node:assert');
const { esTasaValida, extraerValor } = require('../lib/scraper');

describe('esTasaValida', () => {
  it('debe aceptar valores dentro del rango', () => {
    assert.strictEqual(esTasaValida(577.5461), true);
    assert.strictEqual(esTasaValida(1.5), true);
    assert.strictEqual(esTasaValida(9999.99), true);
  });

  it('debe rechazar valores fuera del rango', () => {
    assert.strictEqual(esTasaValida(0.001), false);
    assert.strictEqual(esTasaValida(10001), false);
  });

  it('debe rechazar valores no numéricos', () => {
    assert.strictEqual(esTasaValida('abc'), false);
    assert.strictEqual(esTasaValida(null), false);
    assert.strictEqual(esTasaValida(undefined), false);
    assert.strictEqual(esTasaValida(NaN), false);
  });
});

describe('extraerValor', () => {
  it('debe extraer valor numérico del DOM', () => {
    const $ = require('cheerio').load('<div id="dolar"><strong>57,75</strong></div>');
    const valor = extraerValor($, '#dolar strong');
    assert.strictEqual(valor, 57.75);
  });

  it('debe retornar null si el selector está vacío', () => {
    const $ = require('cheerio').load('<div></div>');
    const valor = extraerValor($, '#dolar strong');
    assert.strictEqual(valor, null);
  });

  it('debe manejar espacios en blanco', () => {
    const $ = require('cheerio').load('<div id="dolar"><strong>  57,75  </strong></div>');
    const valor = extraerValor($, '#dolar strong');
    assert.strictEqual(valor, 57.75);
  });
});

describe('obtenerTasaBCV', () => {
  it('debe retornar stale y conservar el updated_at anterior si el scrape falla', async () => {
    const { obtenerTasaBCV } = require('../lib/scraper');
    const anterior = {
      bcv: { usd: 600.0, eur: 680.0 },
      updated_at: '2026-06-11T12:00:00.000Z',
      stale: false
    };

    const resultado = await obtenerTasaBCV({
      anterior,
      timeout: 1
    });

    assert.strictEqual(resultado.stale, true);
    assert.strictEqual(resultado.updated_at, '2026-06-11T12:00:00.000Z');
    assert.strictEqual(resultado.bcv.usd, 600.0);
  });
});
