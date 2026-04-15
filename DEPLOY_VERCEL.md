# Vercel Deployment (Required for Short Share Links)

To make share links work on Vercel, you must connect **Vercel KV**.

## 1) Project Root
In Vercel project settings, set Root Directory to this folder:
- `New project2/enjazy`

## 2) Connect Vercel KV
1. In Vercel Dashboard: Storage -> Create -> KV
2. Attach the KV database to this project
3. Confirm these env vars exist:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

## 3) Redeploy
After KV is attached, redeploy the project.

## 4) Quick checks
Open:
- `/api/portfolios/test` (should return not_found, not kv_not_configured)

Then test from UI:
1. Add entries (including image/video if needed)
2. Click share button
3. You should get short link: `/share/{id}`

## 5) Notes
- Shared portfolio records are stored for 90 days in KV.
- Password is removed before saving share payload.
