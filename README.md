# BCV-API

Endpoint público para consultar la tasa de cambio del BCV en tus sistemas.

## Endpoint único

```
GET https://bcv-api-ashy.vercel.app/api/tasa
```

No necesitas API key, token ni autenticación.

## Respuesta

```json
{
  "bcv": {
    "usd": 577.55,
    "eur": 667.37
  },
  "updated_at": "2026-06-11T15:45:07.568Z",
  "stale": false
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `bcv.usd` | number | Tasa del dólar (BS/$) |
| `bcv.eur` | number | Tasa del euro (BS/€) |
| `updated_at` | string | Última actualización (ISO 8601) |
| `stale` | boolean | `false` = tasa fresca, `true` = falló scraping, se usó valor anterior |

## Ejemplos de uso

### JavaScript / Node.js

```js
const response = await fetch('https://bcv-api-ashy.vercel.app/api/tasa');
const data = await response.json();
console.log('USD:', data.bcv.usd);
console.log('EUR:', data.bcv.eur);
console.log('Actualizado:', data.updated_at);
```

### PHP

```php
$data = json_decode(file_get_contents('https://bcv-api-ashy.vercel.app/api/tasa'));
echo "USD: " . $data->bcv->usd;
echo "EUR: " . $data->bcv->eur;
```

### Python

```python
import requests
data = requests.get('https://bcv-api-ashy.vercel.app/api/tasa').json()
print(f"USD: {data['bcv']['usd']}")
print(f"EUR: {data['bcv']['eur']}")
```

### cURL

```bash
curl -s https://bcv-api-ashy.vercel.app/api/tasa | jq
```

### Excel / Google Sheets

```
=IMPORTJSON("https://bcv-api-ashy.vercel.app/api/tasa"; "bcv/usd")
```

## Cache

El endpoint incluye `Cache-Control: public, max-age=3600`. Tus sistemas pueden consultarlo sin miedo a saturar — el CDN de Vercel cachea la respuesta por 1 hora.

## Disponibilidad

| Respaldo | Horario (VET) |
|----------|----------------|
| Captura tasa nueva del BCV | 5:00 PM (diario) |
| Backup nocturno | 10:00 PM (diario) |
| Respaldo GitHub RAW | 6:00 AM (lun–vie) |

Si el BCV está caído, el sistema usa la última tasa disponible sin interrupción.
