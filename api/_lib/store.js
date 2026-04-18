import { neon } from "@neondatabase/serverless";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

const hasDbEnv = !!DATABASE_URL;
const sql = hasDbEnv ? neon(DATABASE_URL) : null;
let schemaInitPromise = null;

function dbUnavailable() {
  return { error: "db_not_configured" };
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

async function ensureSchema() {
  if (!hasDbEnv) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS teacher_users (
          id TEXT PRIMARY KEY,
          contact_norm TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          profile JSONB NOT NULL DEFAULT '{}'::jsonb,
          entries JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_shares (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NULL
        );
      `;
      await sql`
        ALTER TABLE portfolio_shares
        ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL;
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_teacher_users_contact_norm
        ON teacher_users (contact_norm);
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_portfolio_shares_expires_at
        ON portfolio_shares (expires_at);
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_shares_owner_user_id_unique
        ON portfolio_shares (owner_user_id)
        WHERE owner_user_id IS NOT NULL;
      `;
    })();
  }
  await schemaInitPromise;
}

async function getUserByContact(contactNorm) {
  await ensureSchema();
  const rows = await sql`
    SELECT id, contact_norm, password, profile, entries
    FROM teacher_users
    WHERE contact_norm = ${contactNorm}
    LIMIT 1;
  `;
  return rows?.[0] || null;
}

async function getUserById(userId) {
  await ensureSchema();
  const rows = await sql`
    SELECT id, contact_norm, password, profile, entries
    FROM teacher_users
    WHERE id = ${userId}
    LIMIT 1;
  `;
  return rows?.[0] || null;
}

export async function registerTeacher(payload) {
  if (!hasDbEnv) return dbUnavailable();
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
      shareTheme: String(payload?.shareTheme || "classic"),
    };

    await sql`
      INSERT INTO teacher_users (id, contact_norm, password, profile, entries, created_at, updated_at)
      VALUES (
        ${userId},
        ${contactNorm},
        ${password},
        ${JSON.stringify(profile)}::jsonb,
        ${JSON.stringify([])}::jsonb,
        NOW(),
        NOW()
      );
    `;

    return {
      data: {
        userId,
        profile: sanitizeProfile(profile),
        entries: [],
      },
    };
  } catch (error) {
    if (String(error?.message || "").includes("duplicate")) {
      return { error: "user_exists", message: "Account already exists." };
    }
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function loginTeacher(payload) {
  if (!hasDbEnv) return dbUnavailable();
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
        userId: user.id,
        profile: sanitizeProfile(user.profile || {}),
        entries: Array.isArray(user.entries) ? user.entries : [],
      },
    };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function resetTeacherPassword(payload) {
  if (!hasDbEnv) return dbUnavailable();
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

    await sql`
      UPDATE teacher_users
      SET password = ${newPassword}, updated_at = NOW()
      WHERE id = ${user.id};
    `;
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function saveTeacherPortfolio(payload) {
  if (!hasDbEnv) return dbUnavailable();
  try {
    const userId = String(payload?.userId || "");
    if (!userId) return { error: "invalid_payload", message: "Missing userId." };

    const user = await getUserById(userId);
    if (!user) return { error: "not_found", message: "User not found." };

    const incomingProfile = payload?.profile || {};
    const profile = {
      name: String(incomingProfile.name || user?.profile?.name || ""),
      contact: String(incomingProfile.contact || user?.profile?.contact || ""),
      school: String(incomingProfile.school || user?.profile?.school || ""),
      subject: String(incomingProfile.subject || user?.profile?.subject || ""),
      grades: String(incomingProfile.grades || user?.profile?.grades || ""),
      shareTheme: String(incomingProfile.shareTheme || user?.profile?.shareTheme || "classic"),
    };
    const contactNorm = normalizeContact(profile.contact);
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];

    await sql`
      UPDATE teacher_users
      SET
        contact_norm = ${contactNorm},
        profile = ${JSON.stringify(profile)}::jsonb,
        entries = ${JSON.stringify(entries)}::jsonb,
        updated_at = NOW()
      WHERE id = ${user.id};
    `;
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function loadTeacherPortfolio(userId) {
  if (!hasDbEnv) return dbUnavailable();
  try {
    const user = await getUserById(String(userId || ""));
    if (!user) return { error: "not_found", message: "User not found." };
    return {
      data: {
        userId: user.id,
        profile: sanitizeProfile(user.profile || {}),
        entries: Array.isArray(user.entries) ? user.entries : [],
      },
    };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function clearTeacherPortfolio(userId) {
  if (!hasDbEnv) return dbUnavailable();
  try {
    const user = await getUserById(String(userId || ""));
    if (!user) return { error: "not_found", message: "User not found." };
    await sql`
      UPDATE teacher_users
      SET entries = ${JSON.stringify([])}::jsonb, updated_at = NOW()
      WHERE id = ${user.id};
    `;
    return { data: { ok: true } };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function createPortfolio(payload, options = {}) {
  if (!hasDbEnv) return dbUnavailable();
  try {
    await ensureSchema();
    const data = sanitizeSharePayload(payload);
    const userId = String(payload?.userId || "").trim();
    const forceNew = !!options?.forceNew;

    if (!userId) {
      return { error: "invalid_payload", message: "Missing userId for portfolio share link." };
    }

    if (!forceNew) {
      const existingRows = await sql`
        SELECT id
        FROM portfolio_shares
        WHERE owner_user_id = ${userId}
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1;
      `;
      const existing = existingRows?.[0];
      if (existing?.id) {
        await sql`
          UPDATE portfolio_shares
          SET data = ${JSON.stringify(data)}::jsonb,
              created_at = NOW(),
              expires_at = NOW() + INTERVAL '90 days'
          WHERE id = ${existing.id};
        `;
        return { id: existing.id, data, reused: true };
      }
    } else {
      await sql`
        DELETE FROM portfolio_shares
        WHERE owner_user_id = ${userId};
      `;
    }

    const id = randomId(8);
    await sql`
      INSERT INTO portfolio_shares (id, owner_user_id, data, created_at, expires_at)
      VALUES (
        ${id},
        ${userId},
        ${JSON.stringify(data)}::jsonb,
        NOW(),
        NOW() + INTERVAL '90 days'
      );
    `;
    return { id, data, reused: false };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function readPortfolio(id) {
  if (!hasDbEnv) return dbUnavailable();
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT data
      FROM portfolio_shares
      WHERE id = ${String(id || "")}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1;
    `;
    const row = rows?.[0];
    if (!row) return { error: "not_found" };
    return { data: row.data };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}
