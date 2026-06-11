# BCV-API
Repositorio personal para obtener tasa bcv diaria en mis sistemas de forma estática en `tasa.json`.

## Despliegue en Vercel (Cron Job Serverless)

Este repositorio está adaptado para ser desplegado en **Vercel** como un Cron Job programado, solucionando las limitaciones de ejecución y horario de las GitHub Actions tradicionales.

### Funcionamiento

1. Un Cron Job de Vercel llama diariamente a las 6:00 AM VET (10:00 AM UTC) al endpoint `/api/cron-bcv`.
2. El script de Node.js realiza el raspado (scraping) de la página del Banco Central de Venezuela.
3. Si los valores son correctos, el script actualiza y commitea el nuevo JSON `tasa.json` directamente en este repositorio de GitHub usando la API REST de GitHub.
4. El archivo actualizado queda expuesto públicamente para tus aplicaciones a través del host estático de GitHub Pages o la URL de Vercel.

### Configuración en Vercel

Debes añadir las siguientes **Variables de Entorno** en tu dashboard de Vercel:

- `GH_REPO`: El identificador de tu repositorio (por ejemplo: `MiUsuario/BCV-API`).
- `GH_TOKEN`: Un token de acceso personal (Personal Access Token - PAT) de GitHub con permisos de escritura de contenido en el repositorio (`contents: write`).
- `CRON_SECRET`: Generado y administrado automáticamente por Vercel para asegurar las llamadas de Cron Jobs (puedes consultarlo en la documentación de Vercel).
