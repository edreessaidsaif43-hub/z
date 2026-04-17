# Vercel Deployment (Neon + Blob)

This project now uses:
- Neon PostgreSQL for auth, portfolios, and share links
- Vercel Blob for image/video uploads

## 1) Required Environment Variables in Vercel
Set one of the following database vars:
- `DATABASE_URL` (recommended)
- or `POSTGRES_URL`

And set media storage var:
- `BLOB_READ_WRITE_TOKEN`

## 2) Redeploy
After saving env vars, redeploy from:
- Vercel Dashboard -> Project -> Deployments -> latest deployment -> Redeploy

## 3) Quick API Checks
1. Open health endpoint:
- `/api/health`
- Expected: `{"ok":true,"status":"ok"}`

2. Open sample portfolio endpoint:
- `/api/portfolios/test`
- Expected (normal when no record): `{"error":"not_found"}`
- Should not return: `db_not_configured`

## 4) Full UI Test
1. Create teacher account
2. Login from another device
3. Add entries + upload image/video
4. Generate share link `/share/{id}`

## 5) Common Errors
- `db_not_configured`: missing `DATABASE_URL`/`POSTGRES_URL`
- `blob_not_configured`: missing `BLOB_READ_WRITE_TOKEN`
