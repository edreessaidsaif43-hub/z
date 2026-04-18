import { requireAdmin } from "../_lib/admin-auth.js";
import { listTeacherAccounts } from "../_lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const auth = requireAdmin(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error, message: auth.message });
    return;
  }

  const out = await listTeacherAccounts();
  if (out.error === "db_not_configured") {
    res.status(500).json({
      error: "db_not_configured",
      message: "Neon database is not configured. Set DATABASE_URL (or POSTGRES_URL) in Vercel.",
    });
    return;
  }
  if (out.error) {
    res.status(502).json({ error: out.error, message: out.message || "Failed to list accounts." });
    return;
  }

  res.status(200).json({ accounts: out.data || [] });
}
