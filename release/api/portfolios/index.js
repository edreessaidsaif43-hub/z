import { createPortfolio } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const payload = req.body || {};
  if (!payload.profile || !Array.isArray(payload.entries)) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  const created = await createPortfolio(payload);
  if (created.error === "gas_not_configured") {
    res.status(500).json({
      error: "gas_not_configured",
      message:
        "Google Apps Script is not configured. Add GAS_WEB_APP_URL in Vercel Environment Variables.",
    });
    return;
  }
  if (created.error) {
    res.status(502).json({
      error: created.error,
      message: "Failed to store portfolio in Google Apps Script backend.",
    });
    return;
  }

  const host = req.headers.host || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}/share/${created.id}`;

  res.status(201).json({ id: created.id, url });
}
