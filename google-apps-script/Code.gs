/**
 * Enjazy Portfolio backend for Google Apps Script.
 * Deploy as Web App (Execute as: Me, Access: Anyone with the link).
 *
 * Required Script Property:
 * - ENJAZY_FOLDER_ID: Google Drive folder ID used to store JSON files.
 *
 * Optional Script Properties:
 * - ENJAZY_MEDIA_FOLDER_ID: folder for uploaded images/videos (fallbacks to ENJAZY_FOLDER_ID).
 * - ENJAZY_USERS_FOLDER_ID: folder for teacher account files (fallbacks to ENJAZY_FOLDER_ID).
 */

function jsonResponse(payload) {
  var out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getStorageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ENJAZY_FOLDER_ID");
  if (!folderId) throw new Error("Missing ENJAZY_FOLDER_ID in Script Properties.");
  return DriveApp.getFolderById(folderId);
}

function getMediaFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ENJAZY_MEDIA_FOLDER_ID");
  if (!folderId) return getStorageFolder_();
  return DriveApp.getFolderById(folderId);
}

function getUsersFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ENJAZY_USERS_FOLDER_ID");
  if (!folderId) return getStorageFolder_();
  return DriveApp.getFolderById(folderId);
}

function randomId_(length) {
  var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var out = "";
  for (var i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function normalizeContact_(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizePublicProfile_(profile) {
  var out = profile || {};
  if (out.password) delete out.password;
  if (out.contactNorm) delete out.contactNorm;
  return out;
}

function sanitizeSharePayload_(payload) {
  return {
    profile: sanitizePublicProfile_(payload && payload.profile ? payload.profile : {}),
    entries: payload && payload.entries ? payload.entries : [],
    generatedAt: payload && payload.generatedAt ? payload.generatedAt : new Date().toISOString()
  };
}

function readJsonFile_(file) {
  return JSON.parse(file.getBlob().getDataAsString());
}

function writeJsonFile_(folder, filename, obj) {
  var files = folder.getFilesByName(filename);
  var body = JSON.stringify(obj);
  if (files.hasNext()) {
    var file = files.next();
    file.setContent(body);
    return file;
  }
  return folder.createFile(filename, body, MimeType.PLAIN_TEXT);
}

function findUserFileByContact_(contactNorm) {
  var folder = getUsersFolder_();
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().indexOf("user-") !== 0) continue;
    var data = readJsonFile_(file);
    if (String(data.contactNorm || "") === String(contactNorm || "")) {
      return { file: file, data: data };
    }
  }
  return null;
}

function findUserFileById_(userId) {
  var folder = getUsersFolder_();
  var filename = "user-" + userId + ".json";
  var files = folder.getFilesByName(filename);
  if (!files.hasNext()) return null;
  var file = files.next();
  var data = readJsonFile_(file);
  return { file: file, data: data };
}

function registerTeacher_(payload) {
  var contactNorm = normalizeContact_(payload.contact);
  if (!contactNorm || !payload.password) {
    return { ok: false, error: "invalid_payload", message: "Missing contact or password." };
  }

  var exists = findUserFileByContact_(contactNorm);
  if (exists) return { ok: false, error: "user_exists", message: "Account already exists." };

  var userId = randomId_(10);
  var profile = {
    name: String(payload.name || ""),
    contact: String(payload.contact || ""),
    school: String(payload.school || ""),
    subject: String(payload.subject || ""),
    grades: String(payload.grades || "")
  };

  var record = {
    userId: userId,
    contactNorm: contactNorm,
    password: String(payload.password || ""),
    profile: profile,
    entries: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  var folder = getUsersFolder_();
  writeJsonFile_(folder, "user-" + userId + ".json", record);

  return {
    ok: true,
    userId: userId,
    profile: sanitizePublicProfile_(profile),
    entries: []
  };
}

function loginTeacher_(payload) {
  var contactNorm = normalizeContact_(payload.contact);
  var password = String(payload.password || "");
  if (!contactNorm || !password) {
    return { ok: false, error: "invalid_credentials", message: "Missing credentials." };
  }

  var user = findUserFileByContact_(contactNorm);
  if (!user) return { ok: false, error: "not_found", message: "Account not found." };
  if (String(user.data.password || "") !== password) {
    return { ok: false, error: "invalid_credentials", message: "Password mismatch." };
  }

  return {
    ok: true,
    userId: user.data.userId,
    profile: sanitizePublicProfile_(user.data.profile || {}),
    entries: user.data.entries || []
  };
}

function resetTeacherPassword_(payload) {
  var contactNorm = normalizeContact_(payload.contact);
  var newPassword = String(payload.newPassword || "");
  var name = String(payload.name || "").trim();
  if (!contactNorm || !newPassword) {
    return { ok: false, error: "invalid_payload", message: "Missing reset fields." };
  }

  var user = findUserFileByContact_(contactNorm);
  if (!user) return { ok: false, error: "not_found", message: "Account not found." };

  if (name) {
    var currentName = String((user.data.profile || {}).name || "").trim();
    if (currentName !== name) {
      return { ok: false, error: "name_mismatch", message: "Teacher name does not match." };
    }
  }

  user.data.password = newPassword;
  user.data.updatedAt = new Date().toISOString();
  user.file.setContent(JSON.stringify(user.data));
  return { ok: true };
}

function saveTeacherPortfolio_(payload) {
  var userId = String(payload.userId || "");
  if (!userId) return { ok: false, error: "invalid_payload", message: "Missing userId." };

  var user = findUserFileById_(userId);
  if (!user) return { ok: false, error: "not_found", message: "User not found." };

  var incomingProfile = payload.profile || {};
  user.data.profile = {
    name: String(incomingProfile.name || user.data.profile.name || ""),
    contact: String(incomingProfile.contact || user.data.profile.contact || ""),
    school: String(incomingProfile.school || user.data.profile.school || ""),
    subject: String(incomingProfile.subject || user.data.profile.subject || ""),
    grades: String(incomingProfile.grades || user.data.profile.grades || "")
  };
  user.data.contactNorm = normalizeContact_(user.data.profile.contact);
  user.data.entries = Array.isArray(payload.entries) ? payload.entries : [];
  user.data.updatedAt = new Date().toISOString();
  user.file.setContent(JSON.stringify(user.data));
  return { ok: true };
}

function loadTeacherPortfolio_(userId) {
  var user = findUserFileById_(String(userId || ""));
  if (!user) return { ok: false, error: "not_found", message: "User not found." };
  return {
    ok: true,
    userId: user.data.userId,
    profile: sanitizePublicProfile_(user.data.profile || {}),
    entries: user.data.entries || []
  };
}

function clearTeacherPortfolio_(userId) {
  var user = findUserFileById_(String(userId || ""));
  if (!user) return { ok: false, error: "not_found", message: "User not found." };
  user.data.entries = [];
  user.data.updatedAt = new Date().toISOString();
  user.file.setContent(JSON.stringify(user.data));
  return { ok: true };
}

function createPortfolio_(payload) {
  var folder = getStorageFolder_();
  var safe = sanitizeSharePayload_(payload || {});
  var id = randomId_(8);
  var filename = id + ".json";
  var tries = 0;
  while (tries < 5) {
    var existing = folder.getFilesByName(filename);
    if (!existing.hasNext()) break;
    id = randomId_(8);
    filename = id + ".json";
    tries++;
  }
  folder.createFile(filename, JSON.stringify(safe), MimeType.PLAIN_TEXT);
  return id;
}

function getPortfolio_(id) {
  var folder = getStorageFolder_();
  var files = folder.getFilesByName(id + ".json");
  if (!files.hasNext()) return null;
  var file = files.next();
  return JSON.parse(file.getBlob().getDataAsString());
}

function uploadMedia_(payload) {
  var folder = getMediaFolder_();
  var fileName = payload && payload.fileName ? String(payload.fileName) : ("media-" + new Date().getTime());
  var mimeType = payload && payload.mimeType ? String(payload.mimeType) : MimeType.PLAIN_TEXT;
  var base64Data = payload && payload.base64Data ? String(payload.base64Data) : "";
  var kind = payload && payload.kind ? String(payload.kind) : "file";
  if (!base64Data) throw new Error("Missing base64Data.");

  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = folder.createFile(blob);
  var sharingEnabled = true;
  var sharingError = "";
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    sharingEnabled = false;
    sharingError = String(err);
  }

  var fileId = file.getId();
  var mediaUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
  if (kind === "video") mediaUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

  return {
    mediaFileId: fileId,
    mediaUrl: mediaUrl,
    mediaName: file.getName(),
    sharingEnabled: sharingEnabled,
    sharingError: sharingError
  };
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : "";
    if (action === "health") return jsonResponse({ ok: true, status: "ok" });

    if (action === "get") {
      var id = e && e.parameter ? e.parameter.id : "";
      if (!id) return jsonResponse({ ok: false, error: "missing_id" });
      var data = getPortfolio_(id);
      if (!data) return jsonResponse({ ok: false, error: "not_found" });
      return jsonResponse({ ok: true, data: data });
    }

    if (action === "loadTeacherPortfolio") {
      var userId = e && e.parameter ? e.parameter.userId : "";
      return jsonResponse(loadTeacherPortfolio_(userId));
    }

    return jsonResponse({ ok: false, error: "invalid_action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: "server_error", message: String(err) });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : "{}";
    var body = JSON.parse(raw);
    var action = body.action || "";

    if (action === "create") return jsonResponse({ ok: true, id: createPortfolio_(body.payload || {}) });
    if (action === "uploadMedia") return jsonResponse(Object.assign({ ok: true }, uploadMedia_(body.payload || {})));
    if (action === "registerTeacher") return jsonResponse(registerTeacher_(body.payload || {}));
    if (action === "loginTeacher") return jsonResponse(loginTeacher_(body.payload || {}));
    if (action === "resetTeacherPassword") return jsonResponse(resetTeacherPassword_(body.payload || {}));
    if (action === "saveTeacherPortfolio") return jsonResponse(saveTeacherPortfolio_(body.payload || {}));
    if (action === "clearTeacherPortfolio") return jsonResponse(clearTeacherPortfolio_(body.payload || {}));

    return jsonResponse({ ok: false, error: "invalid_action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: "server_error", message: String(err) });
  }
}
