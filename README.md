# BCV-API

Endpoint público para consultar la tasa de cambio del BCV en tus sistemas.

## Endpoints

### GET /api/tasa — Tasa actual

```
GET https://bcv-api-ashy.vercel.app/api/tasa
```

No necesitas API key, token ni autenticación.

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

Cache: `no-store` — siempre obtienes el valor más reciente.

---

### GET /api/health — Estado del servicio

```
GET https://bcv-api-ashy.vercel.app/api/health
```

Endpoint para que tus sistemas verifiquen si la tasa está actualizada antes de consumirla.

```json
{
  "status": "ok",
  "tasa": {
    "usd": 577.55,
    "eur": 667.37
  },
  "ultima_actualizacion": "2026-06-21T14:30:00.000Z",
  "horas_desde_actualizacion": 2.5,
  "proxima_actualizacion_estimada": "2026-06-22T14:30:00.000Z",
  "stale": false
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | string | `ok`, `stale` o `error` |
| `tasa` | object | Tasa actual (null si no hay datos) |
| `ultima_actualizacion` | string | ISO 8601 de la última actualización exitosa |
| `horas_desde_actualizacion` | number | Horas transcurridas desde la última actualización |
| `proxima_actualizacion_estimada` | string | Próxima ejecución del cron principal (14:30 UTC) |
| `stale` | boolean | `true` si la tasa está en modo degradado |

---

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

## Disponibilidad

La tasa se captura todos los días, incluyendo fines de semana y feriados. Si el BCV está caído, el sistema usa la última tasa disponible sin interrupción.

| Horario (VET) | Mecanismo | Propósito |
|---------------|-----------|-----------|
| **10:30 AM** | Vercel Cron | Captura principal (justo después de que BCV publica ~10 AM) |
| **4:00 PM** | GitHub Actions | Backup vespertino |
| **10:30 PM** | Vercel Cron | Backup nocturno |
| **4:00 AM** | GitHub Actions | Backup madrugada |

Dos mecanismos independientes (Vercel Cron + GitHub Actions) se respaldan mutuamente. Si uno falla, el otro actualiza la tasa.

## Cache

El endpoint `/api/tasa` usa `Cache-Control: no-store` para garantizar que siempre recibas la tasa más reciente sin riesgo de datos cacheados antiguos.
