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
        "Vercel KV is not configured. Connect KV storage to this project.",
    });
    return;
  }
  if (out.error === "not_found") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (out.error) {
    res.status(502).json({
      error: out.error,
      message: out.message || "Failed to read portfolio from Vercel KV backend.",
    });
    return;
  }

  res.status(200).json(out.data);
}
