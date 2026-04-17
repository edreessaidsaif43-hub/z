const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL || "";

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
  if (!GAS_WEB_APP_URL) {
    return { error: "gas_not_configured" };
  }

  const safePayload = sanitizePayload(payload);
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        payload: safePayload,
      }),
    });

    if (!res.ok) return { error: "upstream_failed" };
    const json = await res.json();
    if (!json?.ok || !json?.id) return { error: "upstream_failed" };
    return { id: String(json.id), data: safePayload };
  } catch (error) {
    return { error: "upstream_failed" };
  }
}

export async function readPortfolio(id) {
  if (!GAS_WEB_APP_URL) return { error: "gas_not_configured" };
  try {
    const url = `${GAS_WEB_APP_URL}?action=get&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET" });
    if (res.status === 404) return { error: "not_found" };
    if (!res.ok) return { error: "upstream_failed" };
    const json = await res.json();
    if (!json?.ok || !json?.data) return { error: "not_found" };
    return { data: json.data };
  } catch (error) {
    return { error: "upstream_failed" };
  }
}

export async function uploadMedia(payload) {
  if (!GAS_WEB_APP_URL) return { error: "gas_not_configured" };
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadMedia",
        payload: {
          fileName: payload?.fileName || "media.bin",
          mimeType: payload?.mimeType || "application/octet-stream",
          base64Data: payload?.base64Data || "",
          kind: payload?.kind || "file",
        },
      }),
    });
    if (!res.ok) return { error: "upstream_failed" };
    const json = await res.json();
    if (!json?.ok || !json?.mediaUrl) return { error: "upstream_failed" };
    return {
      data: {
        mediaFileId: json.mediaFileId || "",
        mediaUrl: json.mediaUrl,
        mediaName: json.mediaName || payload?.fileName || "",
      },
    };
  } catch (error) {
    return { error: "upstream_failed" };
  }
}
