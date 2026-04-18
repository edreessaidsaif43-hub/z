import { requireAdmin } from "../_lib/admin-auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

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
}
