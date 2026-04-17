import { resetTeacherPassword } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const payload = req.body || {};
  const out = await resetTeacherPassword(payload);

  if (out.error === "kv_not_configured") {
    res.status(500).json({
      error: "kv_not_configured",
      message: "Vercel KV is not configured. Connect KV storage to this project.",
    });
    return;
  }
  if (out.error) {
    const status = out.error === "not_found" ? 404 : 502;
    res.status(status).json({ error: out.error, message: out.message || "Password reset failed." });
    return;
  }

  res.status(200).json({ ok: true });
}
