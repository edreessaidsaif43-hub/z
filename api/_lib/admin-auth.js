export function requireAdmin(req) {
  const configured = String(process.env.ADMIN_PASSWORD || "");
  if (!configured) {
    return {
      ok: false,
      status: 500,
      error: "admin_not_configured",
      message: "ADMIN_PASSWORD is not configured in Vercel environment variables.",
    };
  }

  const provided = String(req.headers["x-admin-password"] || "");
  if (!provided || provided !== configured) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Invalid admin password.",
    };
  }

  return { ok: true };
}
