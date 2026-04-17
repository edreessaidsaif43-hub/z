import { kv } from "@vercel/kv";

const hasKvEnv =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

function kvUnavailable() {
  return { error: "kv_not_configured" };
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

function normalizeContact(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeProfile(profile = {}) {
  const out = { ...profile };
  delete out.password;
  delete out.contactNorm;
  return out;
}

function sanitizeSharePayload(payload) {
  return {
    profile: sanitizeProfile(payload?.profile || {}),
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
    generatedAt: payload?.generatedAt || new Date().toISOString(),
  };
}

async function getUserByContact(contactNorm) {
  const userId = await kv.get(`userByContact:${contactNorm}`);
  if (!userId) return null;
  const user = await kv.get(`user:${userId}`);
  return user || null;
}

async function getUserById(userId) {
  const user = await kv.get(`user:${userId}`);
  return user || null;
}

export async function registerTeacher(payload) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const contactNorm = normalizeContact(payload?.contact);
    const password = String(payload?.password || "");
    if (!contactNorm || !password) {
      return { error: "invalid_payload", message: "Missing contact or password." };
    }

    const existing = await getUserByContact(contactNorm);
    if (existing) return { error: "user_exists", message: "Account already exists." };

    const userId = randomId(10);
    const profile = {
      name: String(payload?.name || ""),
      contact: String(payload?.contact || ""),
      school: String(payload?.school || ""),
      subject: String(payload?.subject || ""),
      grades: String(payload?.grades || ""),
    };

    const record = {
      userId,
      contactNorm,
      password,
      profile,
      entries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, record);
    await kv.set(`userByContact:${contactNorm}`, userId);

    return {
      data: {
        userId,
        profile: sanitizeProfile(profile),
        entries: [],
      },
    };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function loginTeacher(payload) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const contactNorm = normalizeContact(payload?.contact);
    const password = String(payload?.password || "");
    if (!contactNorm || !password) {
      return { error: "invalid_credentials", message: "Missing credentials." };
    }

    const user = await getUserByContact(contactNorm);
    if (!user) return { error: "not_found", message: "Account not found." };
    if (String(user.password || "") !== password) {
      return { error: "invalid_credentials", message: "Password mismatch." };
    }

    return {
      data: {
        userId: user.userId,
        profile: sanitizeProfile(user.profile || {}),
        entries: Array.isArray(user.entries) ? user.entries : [],
      },
    };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function resetTeacherPassword(payload) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const contactNorm = normalizeContact(payload?.contact);
    const newPassword = String(payload?.newPassword || "");
    const name = String(payload?.name || "").trim();
    if (!contactNorm || !newPassword) {
      return { error: "invalid_payload", message: "Missing reset fields." };
    }

    const user = await getUserByContact(contactNorm);
    if (!user) return { error: "not_found", message: "Account not found." };
    if (name) {
      const currentName = String(user?.profile?.name || "").trim();
      if (currentName !== name) {
        return { error: "name_mismatch", message: "Teacher name does not match." };
      }
    }

    user.password = newPassword;
    user.updatedAt = new Date().toISOString();
    await kv.set(`user:${user.userId}`, user);
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function saveTeacherPortfolio(payload) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const userId = String(payload?.userId || "");
    if (!userId) return { error: "invalid_payload", message: "Missing userId." };

    const user = await getUserById(userId);
    if (!user) return { error: "not_found", message: "User not found." };

    const incomingProfile = payload?.profile || {};
    user.profile = {
      name: String(incomingProfile.name || user?.profile?.name || ""),
      contact: String(incomingProfile.contact || user?.profile?.contact || ""),
      school: String(incomingProfile.school || user?.profile?.school || ""),
      subject: String(incomingProfile.subject || user?.profile?.subject || ""),
      grades: String(incomingProfile.grades || user?.profile?.grades || ""),
    };
    user.contactNorm = normalizeContact(user.profile.contact);
    user.entries = Array.isArray(payload?.entries) ? payload.entries : [];
    user.updatedAt = new Date().toISOString();

    await kv.set(`user:${user.userId}`, user);
    if (user.contactNorm) await kv.set(`userByContact:${user.contactNorm}`, user.userId);
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function loadTeacherPortfolio(userId) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const user = await getUserById(String(userId || ""));
    if (!user) return { error: "not_found", message: "User not found." };
    return {
      data: {
        userId: user.userId,
        profile: sanitizeProfile(user.profile || {}),
        entries: Array.isArray(user.entries) ? user.entries : [],
      },
    };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function clearTeacherPortfolio(userId) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const user = await getUserById(String(userId || ""));
    if (!user) return { error: "not_found", message: "User not found." };
    user.entries = [];
    user.updatedAt = new Date().toISOString();
    await kv.set(`user:${user.userId}`, user);
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function createPortfolio(payload) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const data = sanitizeSharePayload(payload);
    const id = randomId(8);
    await kv.set(`share:${id}`, data, { ex: 60 * 60 * 24 * 90 });
    return { id, data };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function readPortfolio(id) {
  if (!hasKvEnv) return kvUnavailable();
  try {
    const data = await kv.get(`share:${String(id || "")}`);
    if (!data) return { error: "not_found" };
    return { data };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}
