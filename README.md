# BCV-API

Obtén la tasa de cambio del BCV (Banco Central de Venezuela) de forma estática en `tasa.json`.

## Endpoint público

```
GET https://bcv-api.vercel.app/api/tasa
```

Respuesta:
```json
{
  "bcv": {
    "usd": 57.75,
    "eur": 66.23
  },
  "updated_at": "2026-06-11T06:00:00.000Z",
  "stale": false
}
```

## Cómo funciona

| Mecanismo | Schedule (VET) | Descripción |
|-----------|----------------|-------------|
| GitHub Actions | 6:00 AM (lun–vie) | Scrapea BCV y commitea `tasa.json` al repo |
| Vercel Cron #1 | 5:00 PM (diario) | Captura la tasa nueva del BCV y guarda en Blob |
| Vercel Cron #2 | 10:00 PM (diario) | Backup nocturno en Blob |
| Endpoint `/api/tasa` | — | Sirve desde Blob con fallback a GitHub RAW |

## Despliegue manual

```bash
npm start
```

## Tests

```bash
npm test
npm run lint
```

## Configuración en Vercel

Variables de entorno requeridas en Vercel:

| Variable | Descripción |
|----------|-------------|
| `CRON_SECRET` | Secreto de Vercel Cron (autogenerado) |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob (autogenerado al añadir Blob) |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (opcional, para alertas) |
| `TELEGRAM_CHAT_ID` | ID del chat de Telegram (opcional, para alertas) |
| `FALLBACK_RAW_URL` | URL raw de GitHub (opcional): `https://raw.githubusercontent.com/usuario/repo/main/tasa.json` |

Ya no se necesita `GH_REPO` ni `GH_TOKEN` en Vercel.
