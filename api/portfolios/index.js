import { createPortfolio } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const payload = req.body || {};
  if (!payload.userId || !payload.profile || !Array.isArray(payload.entries)) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  const created = await createPortfolio(payload, { forceNew: false });
  if (created.error === "db_not_configured") {
    res.status(500).json({
      error: "db_not_configured",
      message:
        "Neon database is not configured. Set DATABASE_URL (or POSTGRES_URL) in Vercel.",
    });
    return;
  }
  if (created.error) {
    res.status(502).json({
      error: created.error,
      message: created.message || "Failed to store portfolio in Neon database backend.",
    });
    return;
  }

  const host = req.headers.host || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}/share/${created.id}`;

  res.status(201).json({ id: created.id, url, reused: !!created.reused });
}
