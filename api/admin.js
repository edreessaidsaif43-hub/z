import { requireAdmin } from "./_lib/admin-auth.js";
import {
  listTeacherAccounts,
  loadTeacherAccountByAdmin,
  updateTeacherAccountByAdmin,
  deleteTeacherAccountByAdmin,
} from "./_lib/store.js";

export default async function handler(req, res) {
  const action = String(req.query?.action || req.body?.action || "");

  if (req.method === "POST" && action === "login") {
    const fakeReq = {
      headers: {
        "x-admin-password": String(req.body?.password || ""),
      },
    };
    const auth = requireAdmin(fakeReq);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error, message: auth.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  const auth = requireAdmin(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error, message: auth.message });
    return;
  }

  if (req.method === "GET" && action === "accounts") {
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
    return;
  }

  if (req.method === "GET" && action === "account") {
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

  if (req.method === "POST" && action === "delete_account") {
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

  if (req.method === "POST" && action === "update_account") {
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
