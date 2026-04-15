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
  if (created.error === "kv_not_configured") {
    res.status(500).json({
      error: "kv_not_configured",
      message:
        "Vercel KV is not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN.",
    });
    return;
  }

  const host = req.headers.host || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}/share/${created.id}`;

  res.status(201).json({ id: created.id, url });
}
