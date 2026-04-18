import { requireAdmin } from "../_lib/admin-auth.js";
import {
  loadTeacherAccountByAdmin,
  updateTeacherAccountByAdmin,
  deleteTeacherAccountByAdmin,
} from "../_lib/store.js";

export default async function handler(req, res) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error, message: auth.message });
    return;
  }

  if (req.method === "GET") {
    const userId = String(req.query?.userId || "");
    if (!userId) {
      res.status(400).json({ error: "invalid_payload", message: "Missing userId." });
      return;
    }
    const out = await loadTeacherAccountByAdmin(userId);
    if (out.error === "db_not_configured") {
      res.status(500).json({
        error: "db_not_configured",
        message: "Neon database is not configured. Set DATABASE_URL (or POSTGRES_URL) in Vercel.",
      });
      return;
    }
    if (out.error) {
      const status = out.error === "not_found" ? 404 : 502;
      res.status(status).json({ error: out.error, message: out.message || "Failed to load account." });
      return;
    }
    res.status(200).json(out.data);
    return;
  }

  if (req.method === "POST") {
    const action = String(req.body?.action || "update");
    if (action === "delete") {
      const userId = String(req.body?.userId || "");
      const out = await deleteTeacherAccountByAdmin(userId);
      if (out.error === "db_not_configured") {
        res.status(500).json({
          error: "db_not_configured",
          message: "Neon database is not configured. Set DATABASE_URL (or POSTGRES_URL) in Vercel.",
        });
        return;
      }
      if (out.error) {
        const status = out.error === "not_found" ? 404 : 502;
        res.status(status).json({ error: out.error, message: out.message || "Failed to delete account." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    const out = await updateTeacherAccountByAdmin(req.body || {});
    if (out.error === "db_not_configured") {
      res.status(500).json({
        error: "db_not_configured",
        message: "Neon database is not configured. Set DATABASE_URL (or POSTGRES_URL) in Vercel.",
      });
      return;
    }
    if (out.error) {
      const status =
        out.error === "not_found" ? 404 : out.error === "invalid_payload" || out.error === "contact_exists" ? 400 : 502;
      res.status(status).json({ error: out.error, message: out.message || "Failed to update account." });
      return;
    }
    res.status(200).json(out.data);
    return;
  }

  res.status(405).json({ error: "method_not_allowed" });
}
