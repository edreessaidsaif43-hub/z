# Oman Teacher Portfolio (Enjazy)

Professional digital portfolio platform for teachers.

## Stack
- Frontend: `index.html`
- API: Vercel Serverless Functions (`/api/*`)
- Database: Neon PostgreSQL (`DATABASE_URL`)
- Media: Vercel Blob (`BLOB_READ_WRITE_TOKEN`)

## Local Run
Use one of:
- `start.bat`
- `powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8000`

Then open:
- `http://localhost:8000`

## Vercel Deployment
1. Import the project in Vercel
2. Set environment variables:
- `DATABASE_URL` (or `POSTGRES_URL`)
- `BLOB_READ_WRITE_TOKEN`
3. Redeploy

Detailed guide:
- `DEPLOY_VERCEL.md`

## Build Release Package
Run:
```powershell
powershell -ExecutionPolicy Bypass -File .\build-release.ps1
```

Output:
- `release/`
- `enjazy-release.zip`

## Notes
- No dependency on Google Apps Script
- No dependency on Vercel KV / Upstash Redis
