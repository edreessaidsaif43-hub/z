# Vercel Deployment (Vercel-Only Data)

This project now uses only Vercel services:
- **Vercel KV** for accounts, portfolio data, and short share links
- **Vercel Blob** for images/videos

## 1) Connect Vercel KV
1. Vercel Dashboard -> Storage -> Create -> KV
2. Connect KV to this project
3. Confirm env vars exist:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

## 2) Connect Vercel Blob
1. Vercel Dashboard -> Storage -> Create -> Blob
2. Connect Blob to this project
3. Confirm env var exists:
   - `BLOB_READ_WRITE_TOKEN`

## 3) Redeploy
After connecting KV + Blob, redeploy project.

## 4) Verify
1. Open:
   - `/api/portfolios/test`
2. Expected:
   - `{"error":"not_found"}` (good)
   - Not `kv_not_configured`

## 5) Test from UI
1. Create account
2. Login from another device (should work)
3. Add entries and upload image/video
4. Click Share -> short link `/share/{id}`
