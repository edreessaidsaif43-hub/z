const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL || "";

function sanitizeSharePayload(payload) {
  const profile = { ...(payload?.profile || {}) };
  delete profile.password;
  return {
    profile,
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
    generatedAt: payload?.generatedAt || new Date().toISOString(),
  };
}

async function gasPost(action, payload) {
  if (!GAS_WEB_APP_URL) return { error: "gas_not_configured" };
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) return { error: "upstream_failed", message: `HTTP_${res.status}` };
    const json = await res.json();
    if (!json?.ok) {
      return {
        error: json?.error || "upstream_failed",
        message: json?.message || "Google Apps Script returned a failed response.",
      };
    }
    return { data: json };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

async function gasGet(params) {
  if (!GAS_WEB_APP_URL) return { error: "gas_not_configured" };
  try {
    const url = `${GAS_WEB_APP_URL}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { method: "GET" });
    if (res.status === 404) return { error: "not_found" };
    if (!res.ok) return { error: "upstream_failed", message: `HTTP_${res.status}` };
    const json = await res.json();
    if (!json?.ok) {
      return {
        error: json?.error || "upstream_failed",
        message: json?.message || "Google Apps Script returned a failed response.",
      };
    }
    return { data: json };
  } catch (error) {
    return { error: "upstream_failed", message: String(error?.message || error) };
  }
}

export async function registerTeacher(payload) {
  return gasPost("registerTeacher", payload || {});
}

export async function loginTeacher(payload) {
  return gasPost("loginTeacher", payload || {});
}

export async function resetTeacherPassword(payload) {
  return gasPost("resetTeacherPassword", payload || {});
}

export async function saveTeacherPortfolio(payload) {
  const safePayload = {
    userId: payload?.userId || "",
    profile: { ...(payload?.profile || {}) },
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
  };
  delete safePayload.profile.password;
  return gasPost("saveTeacherPortfolio", safePayload);
}

export async function loadTeacherPortfolio(userId) {
  return gasGet({ action: "loadTeacherPortfolio", userId: String(userId || "") });
}

export async function clearTeacherPortfolio(userId) {
  return gasPost("clearTeacherPortfolio", { userId: String(userId || "") });
}

export async function createPortfolio(payload) {
  const out = await gasPost("create", sanitizeSharePayload(payload));
  if (out.error) return out;
  const id = out?.data?.id;
  if (!id) return { error: "upstream_failed", message: "Missing id from GAS response." };
  return { id: String(id), data: sanitizeSharePayload(payload) };
}

export async function readPortfolio(id) {
  const out = await gasGet({ action: "get", id: String(id || "") });
  if (out.error === "not_found") return out;
  if (out.error) return out;
  if (!out?.data?.data) return { error: "not_found" };
  return { data: out.data.data };
}

export async function uploadMedia(payload) {
  const out = await gasPost("uploadMedia", {
    fileName: payload?.fileName || "media.bin",
    mimeType: payload?.mimeType || "application/octet-stream",
    base64Data: payload?.base64Data || "",
    kind: payload?.kind || "file",
  });
  if (out.error) return out;
  const json = out.data || {};
  if (!json?.mediaUrl) {
    return {
      error: "upstream_failed",
      message: "Google Apps Script returned an invalid media response.",
    };
  }
  return {
    data: {
      mediaFileId: json.mediaFileId || "",
      mediaUrl: json.mediaUrl,
      mediaName: json.mediaName || payload?.fileName || "",
      sharingEnabled: json.sharingEnabled !== false,
      sharingError: json.sharingError || "",
    },
  };
}
