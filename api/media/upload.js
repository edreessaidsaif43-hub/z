import { uploadMedia } from "../_lib/store.js";

const MAX_BASE64_LEN = 4_000_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const payload = req.body || {};
  const fileName = String(payload.fileName || "");
  const mimeType = String(payload.mimeType || "");
  const base64Data = String(payload.base64Data || "");
  const kind = String(payload.kind || "file");

  if (!fileName || !mimeType || !base64Data) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  if (base64Data.length > MAX_BASE64_LEN) {
    res.status(413).json({
      error: "payload_too_large",
      message: "Media is too large for serverless upload. Please use a smaller file.",
    });
    return;
  }

  const out = await uploadMedia({ fileName, mimeType, base64Data, kind });
  if (out.error === "gas_not_configured") {
    res.status(500).json({
      error: "gas_not_configured",
      message:
        "Google Apps Script is not configured. Add GAS_WEB_APP_URL in Vercel Environment Variables.",
    });
    return;
  }
  if (out.error) {
    res.status(502).json({
      error: out.error,
      message: "Failed to upload media to Google Apps Script backend.",
    });
    return;
  }

  res.status(201).json(out.data);
}
