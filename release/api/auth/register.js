import { registerTeacher } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const payload = req.body || {};
  const out = await registerTeacher(payload);

  if (out.error === "gas_not_configured") {
    res.status(500).json({
      error: "gas_not_configured",
      message: "GAS_WEB_APP_URL is missing in Vercel environment variables.",
    });
    return;
  }
  if (out.error) {
    const status = out.error === "user_exists" ? 409 : 502;
    res.status(status).json({ error: out.error, message: out.message || "Register failed." });
    return;
  }

  res.status(201).json({
    userId: out.data.userId,
    profile: out.data.profile || {},
    entries: Array.isArray(out.data.entries) ? out.data.entries : [],
  });
}
