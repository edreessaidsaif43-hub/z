/**
 * Enjazy Portfolio backend for Google Apps Script.
 * Deploy as Web App (Execute as: Me, Access: Anyone with the link).
 *
 * Required Script Property:
 * - ENJAZY_FOLDER_ID: Google Drive folder ID used to store JSON files.
 * Optional Script Property:
 * - ENJAZY_MEDIA_FOLDER_ID: folder for uploaded images/videos (fallbacks to ENJAZY_FOLDER_ID).
 */

function jsonResponse(payload, statusCode) {
  var out = ContentService.createTextOutput(JSON.stringify(payload));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getStorageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ENJAZY_FOLDER_ID");
  if (!folderId) {
    throw new Error("Missing ENJAZY_FOLDER_ID in Script Properties.");
  }
  return DriveApp.getFolderById(folderId);
}

function getMediaFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("ENJAZY_MEDIA_FOLDER_ID");
  if (!folderId) return getStorageFolder_();
  return DriveApp.getFolderById(folderId);
}

function randomId_(length) {
  var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var out = "";
  for (var i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function sanitizePayload_(payload) {
  var profile = payload && payload.profile ? payload.profile : {};
  if (profile && profile.password) {
    delete profile.password;
  }
  return {
    profile: profile || {},
    entries: payload && payload.entries ? payload.entries : [],
    generatedAt: payload && payload.generatedAt ? payload.generatedAt : new Date().toISOString()
  };
}

function createPortfolio_(payload) {
  var folder = getStorageFolder_();
  var safe = sanitizePayload_(payload || {});

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

  if (!base64Data) {
    throw new Error("Missing base64Data.");
  }

  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var mediaUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
  if (kind === "video") {
    mediaUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
  }

  return {
    mediaFileId: fileId,
    mediaUrl: mediaUrl,
    mediaName: file.getName()
  };
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : "";
    if (action === "health") {
      return jsonResponse({ ok: true, status: "ok" });
    }

    if (action === "get") {
      var id = e && e.parameter ? e.parameter.id : "";
      if (!id) return jsonResponse({ ok: false, error: "missing_id" });
      var data = getPortfolio_(id);
      if (!data) return jsonResponse({ ok: false, error: "not_found" });
      return jsonResponse({ ok: true, data: data });
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

    if (action === "create") {
      var id = createPortfolio_(body.payload || {});
      return jsonResponse({ ok: true, id: id });
    }

    if (action === "uploadMedia") {
      var uploaded = uploadMedia_(body.payload || {});
      return jsonResponse({
        ok: true,
        mediaFileId: uploaded.mediaFileId,
        mediaUrl: uploaded.mediaUrl,
        mediaName: uploaded.mediaName
      });
    }

    return jsonResponse({ ok: false, error: "invalid_action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: "server_error", message: String(err) });
  }
}
