import { readPortfolio } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const { id } = req.query || {};
  if (!id) {
    res.status(400).json({ error: "missing_id" });
    return;
  }

  const out = await readPortfolio(String(id));
  if (out.error === "kv_not_configured") {
    res.status(500).json({
      error: "kv_not_configured",
      message:
        "Vercel KV is not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN.",
    });
    return;
  }
  if (out.error === "not_found") {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.status(200).json(out.data);
}
