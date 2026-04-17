# Vercel Deployment with Google Apps Script Storage

This project now stores share links in **Google Apps Script** (not Vercel KV).

## 1) Deploy Google Apps Script backend
1. Open [script.google.com](https://script.google.com)
2. Create a new project
3. Copy code from:
   - `google-apps-script/Code.gs`
4. In Google Drive, create a folder for saved portfolios
5. Copy that folder ID
6. In Apps Script: Project Settings -> Script properties:
   - `ENJAZY_FOLDER_ID=YOUR_FOLDER_ID`
   - `ENJAZY_MEDIA_FOLDER_ID=YOUR_MEDIA_FOLDER_ID` (optional, if omitted uses ENJAZY_FOLDER_ID)
   - `ENJAZY_USERS_FOLDER_ID=YOUR_USERS_FOLDER_ID` (optional, if omitted uses ENJAZY_FOLDER_ID)
7. Deploy -> New deployment -> Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Copy Web app URL (ends with `/exec`)

## 2) Configure Vercel env var
In Vercel project settings -> Environment Variables:
- `GAS_WEB_APP_URL = https://script.google.com/macros/s/.../exec`

## 2.1) Configure Vercel Blob (for images/videos)
1. Vercel Dashboard -> Storage -> Create -> Blob
2. Connect Blob to this project
3. Confirm env var exists:
   - `BLOB_READ_WRITE_TOKEN`

Then redeploy project.

## 3) Verify
1. Open:
   - `/api/portfolios/test`
2. Expected:
   - `{"error":"not_found"}` (good)
   - Not `gas_not_configured`

## 4) Test from UI
1. Add portfolio entries
2. Click Share
3. You should get short link: `/share/{id}`

## Media Upload Notes
- Images/videos are uploaded as real files to Vercel Blob storage.
- The app stores only file URL/id in portfolio entries.
- Keep media files small for serverless upload (recommended <= 3MB).

## Accounts & Portfolio DB
- Teacher accounts and portfolio entries are stored in Google Drive JSON files through Apps Script.
- Login/register/save/load now depend on GAS backend, not browser localStorage.
