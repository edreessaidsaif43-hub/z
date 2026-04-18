import { put } from "@vercel/blob";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const SAFE_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

function cleanFileName(name, mimeType) {
  const raw = String(name || "media").replace(/[^a-zA-Z0-9._-]/g, "_");
  const hasExt = /\.[a-zA-Z0-9]+$/.test(raw);
  if (hasExt) return raw;
  return `${raw}${SAFE_EXT[mimeType] || ".bin"}`;
}

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

  try {
    const bytes = Buffer.from(base64Data, "base64");
    const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (bytes.length > maxBytes) {
      const maxLabel = kind === "video" ? "50MB" : "3MB";
      res.status(413).json({
        error: "payload_too_large",
        message: `Media is too large. Maximum allowed size is ${maxLabel}.`,
      });
      return;
    }
    const folder = kind === "video" ? "videos" : "images";
    const stamp = Date.now();
    const safeName = cleanFileName(fileName, mimeType);
    const pathname = `portfolio-media/${folder}/${stamp}-${safeName}`;

    const blob = await put(pathname, bytes, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true,
    });

    res.status(201).json({
      mediaFileId: blob.pathname,
      mediaUrl: blob.url,
      mediaName: safeName,
      sharingEnabled: true,
      sharingError: "",
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("BLOB_READ_WRITE_TOKEN")) {
      res.status(500).json({
        error: "blob_not_configured",
        message:
          "Vercel Blob is not configured. Connect Blob storage or set BLOB_READ_WRITE_TOKEN.",
      });
      return;
    }
    res.status(502).json({
      error: "blob_upload_failed",
      message: message || "Failed to upload media to Vercel Blob.",
    });
  }
}
