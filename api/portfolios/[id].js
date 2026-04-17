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
  if (out.error === "gas_not_configured") {
    res.status(500).json({
      error: "gas_not_configured",
      message:
        "Google Apps Script is not configured. Add GAS_WEB_APP_URL in Vercel Environment Variables.",
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
      message: "Failed to read portfolio from Google Apps Script backend.",
    });
    return;
  }

  res.status(200).json(out.data);
}
