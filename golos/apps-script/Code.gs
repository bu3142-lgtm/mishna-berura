// Озвучка «Мишна Брура»: сервер на Google Apps Script.
// Хранит записи голоса на Google Диске в папке «Мишна Брура — озвучка» (по подпапке на главу).
// Развёртывание: «Веб-приложение», запуск от имени автора («Я»), доступ — «Все».
// Слушать может любой (GET list/get); записывать и стирать — только с паролем.

const PASSWORD = 'ЗАМЕНИТЬ_ПАРОЛЬ';
const ROOT_NAME = 'Мишна Брура — озвучка';

function root_() {
  const it = DriveApp.getFoldersByName(ROOT_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
}
function chapterFolder_(ch, create) {
  const r = root_();
  const it = r.getFoldersByName(String(ch));
  if (it.hasNext()) return it.next();
  return create ? r.createFolder(String(ch)) : null;
}
function base_(name) { return name.replace(/\.[^.]+$/, ''); }
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function validKey_(k) { return /^[0-9]{1,4}_[A-Za-z0-9_]{1,24}$/.test(String(k || '')); }
function validCh_(c) { return /^[0-9]{1,4}$/.test(String(c || '')); }

function findFiles_(folder, key) {
  const res = [];
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (base_(f.getName()) === key) res.push(f); }
  return res;
}

function doGet(e) {
  try {
    const p = e.parameter || {};
    if (!validCh_(p.chapter)) return out_({ ok: false, error: 'bad_request' });
    const folder = chapterFolder_(p.chapter, false);
    if (p.action === 'list') {
      const items = {};
      if (folder) {
        const it = folder.getFiles();
        while (it.hasNext()) {
          const f = it.next();
          items[base_(f.getName())] = { t: f.getLastUpdated().getTime(), s: f.getSize(), m: f.getDescription() || f.getMimeType() };
        }
      }
      return out_({ ok: true, items: items });
    }
    if (p.action === 'get') {
      if (!validKey_(p.key) || !folder) return out_({ ok: false, error: 'not_found' });
      const files = findFiles_(folder, p.key);
      if (!files.length) return out_({ ok: false, error: 'not_found' });
      const f = files[0];
      return out_({ ok: true, mime: f.getDescription() || f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) });
    }
    return out_({ ok: false, error: 'bad_request' });
  } catch (err) {
    return out_({ ok: false, error: 'server', message: String(err) });
  }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.pass !== PASSWORD) return out_({ ok: false, error: 'auth' });
    if (b.action === 'auth') return out_({ ok: true });
    if (!validCh_(b.chapter) || !validKey_(b.key)) return out_({ ok: false, error: 'bad_request' });
    if (b.action === 'save') {
      const mime = String(b.mime || 'audio/mp4').split(';')[0];
      const ext = mime.indexOf('webm') >= 0 ? 'webm' : mime.indexOf('ogg') >= 0 ? 'ogg' : mime.indexOf('mpeg') >= 0 ? 'mp3' : 'm4a';
      const bytes = Utilities.base64Decode(b.data);
      const folder = chapterFolder_(b.chapter, true);
      const old = findFiles_(folder, b.key);
      const blob = Utilities.newBlob(bytes, mime, b.key + '.' + ext);
      const file = folder.createFile(blob);
      file.setDescription(mime);
      old.forEach(function (f) { f.setTrashed(true); });
      return out_({ ok: true, t: file.getLastUpdated().getTime(), s: bytes.length, m: mime });
    }
    if (b.action === 'delete') {
      const folder = chapterFolder_(b.chapter, false);
      if (folder) findFiles_(folder, b.key).forEach(function (f) { f.setTrashed(true); });
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'bad_request' });
  } catch (err) {
    return out_({ ok: false, error: 'server', message: String(err) });
  }
}
