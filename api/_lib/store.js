const hasKvEnv =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let kvClient = null;

async function getKv() {
  if (!hasKvEnv) return null;
  if (!kvClient) {
    const mod = await import("@vercel/kv");
    kvClient = mod.kv;
  }
  return kvClient;
}

function randomId(length = 10) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sanitizePayload(payload) {
  const profile = { ...(payload?.profile || {}) };
  delete profile.password;
  return {
    profile,
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
    generatedAt: payload?.generatedAt || new Date().toISOString(),
  };
}

export async function createPortfolio(payload) {
  const kv = await getKv();
  if (!kv) {
    return { error: "kv_not_configured" };
  }

  const safePayload = sanitizePayload(payload);
  let id = randomId(8);
  let tries = 0;

  while (tries < 5) {
    const exists = await kv.get(`portfolio:${id}`);
    if (!exists) break;
    id = randomId(8);
    tries += 1;
  }

  await kv.set(`portfolio:${id}`, safePayload, { ex: 60 * 60 * 24 * 90 });
  return { id, data: safePayload };
}

export async function readPortfolio(id) {
  const kv = await getKv();
  if (!kv) return { error: "kv_not_configured" };
  const data = await kv.get(`portfolio:${id}`);
  if (!data) return { error: "not_found" };
  return { data };
}
