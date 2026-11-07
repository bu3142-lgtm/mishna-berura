'use strict';
/* Озвучка «Мишны Бруры»: запись голоса автора (страница golos/) и воспроизведение (весь сайт).
   Записи хранятся на Google Диске; сервер — Google Apps Script (golos/apps-script/Code.gs). */
(function () {
  // Адрес веб-приложения Apps Script (…/exec). Пока пусто — озвучка отключена.
  const VOICE_URL = 'https://script.google.com/macros/s/AKfycbynm5O75gVsrAVNu-oJJZamjQeiVoOAIintuep88pifIaYi-7W44cBW7I1UTZsRmhaV/exec';
  const REC = !!window.MB_RECORDER;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const lists = new Map();      // глава -> {items:{key:{t,s,m}}}
  const loading = new Map();
  const S = { rec: null, pending: null, saving: false, error: '', flash: '', playing: null, preview: null };
  let ctx = null, bar = null, timer = null, wake = null, flashTimer = null;
  const audio = new Audio();
  const preview = new Audio();

  /* ---------- список записей главы ---------- */
  const LKEY = ch => 'mb-voice-list-' + ch;
  function cachedList(ch) {
    if (lists.has(ch)) return;
    try { const j = JSON.parse(localStorage.getItem(LKEY(ch))); if (j && j.items) lists.set(ch, j); } catch (e) { }
  }
  function storeList(ch) { try { localStorage.setItem(LKEY(ch), JSON.stringify(lists.get(ch))); } catch (e) { } }
  function refreshList(ch) {
    if (loading.has(ch)) return loading.get(ch);
    const p = (async () => {
      try {
        const r = await fetch(`${VOICE_URL}?action=list&chapter=${ch}`);
        const j = await r.json();
        if (j.ok) { lists.set(ch, { items: j.items }); storeList(ch); }
      } catch (e) { } finally { loading.delete(ch); }
    })();
    loading.set(ch, p);
    return p;
  }
  const chOf = key => Number(String(key).split('_')[0]);
  const itemFor = key => { const l = lists.get(chOf(key)); return l && l.items[key]; };
  function setItem(key, it) {
    const ch = chOf(key); if (!lists.has(ch)) lists.set(ch, { items: {} });
    if (it) lists.get(ch).items[key] = it; else delete lists.get(ch).items[key];
    storeList(ch);
  }

  /* ---------- единицы озвучки на странице ---------- */
  function sifUnits(data, s) {
    const u = [];
    if (s.blocks.some(b => b.kind !== 'rema')) u.push({ key: `${data.chapter}_${s.n}_sa`, label: 'Шулхан Арух' });
    if (s.blocks.some(b => b.kind === 'rema')) u.push({ key: `${data.chapter}_${s.n}_rema`, label: 'Рамо' });
    return u;
  }
  function allKeys(data) {
    const k = [];
    for (const s of data.seifim) {
      sifUnits(data, s).forEach(u => k.push(u.key));
      if (s.introduction) k.push(`${data.chapter}_${s.n}_intro`);
      s.comments.forEach(c => k.push(`${data.chapter}_mb${c.n}`));
    }
    return k;
  }
  function unitHTML(key, label, extra) {
    return `<span class="vx-label">${esc(label)}</span><span class="vx-ctrls"></span>`;
  }
  function mk(tag, cls, key, label, seif) {
    const el = document.createElement(tag);
    el.className = cls; el.dataset.vkey = key; el.dataset.vlabel = label; el.dataset.vseif = seif;
    el.innerHTML = unitHTML(key, label);
    return el;
  }
  function render(data, s) {
    if (!VOICE_URL) return;
    const reader = $('#reader'); if (!reader) return;
    const ch = data.chapter;
    ctx = { data, s };
    cachedList(ch);
    const panel = document.createElement('div'); panel.className = 'vx-panel';
    if (REC) { const pr = document.createElement('div'); pr.className = 'vx-progress'; panel.append(pr); }
    if (!REC) sifUnits(data, s).forEach(u => panel.append(mk('div', 'vx-unit', u.key, u.label, s.n)));
    const title = $('.law-title', reader);
    if (title) title.after(panel);
    if (REC) {
      reader.querySelectorAll('.law-pair').forEach(e => e.remove());
      const secs = ['sa', 'rema'].map(k => lawSection(data, s, k)).filter(Boolean);
      panel.after(...secs);
    }
    reader.querySelectorAll('.comment').forEach(el => {
      let key, label;
      if (el.id === 'mb-introduction') { key = `${ch}_${s.n}_intro`; label = 'Вступление Мишны Бруры'; }
      else if (/^mb-\d+$/.test(el.id)) {
        const letter = $('.comment-letter', el);
        key = `${ch}_mb${el.id.slice(3)}`; label = 'Мишна Брура · ' + (letter ? letter.textContent.trim() : '');
      } else return;
      el.prepend(mk('div', 'vx-unit vx-inline', key, label, s.n));
    });
    paintAll();
    refreshList(ch).then(() => { if (ctx && ctx.data.chapter === ch) paintAll(); });
  }

  /* Страница записи: весь Шулхан Арух и всё Рамо пункта — каждый одним блоком (иврит + перевод) */
  function lawSection(data, s, kind) {
    const bs = s.blocks.filter(b => (kind === 'rema') === (b.kind === 'rema'));
    if (!bs.length) return null;
    const key = `${data.chapter}_${s.n}_${kind}`, label = kind === 'rema' ? 'Рамо' : 'Шулхан Арух';
    const sec = document.createElement('section'); sec.className = 'vx-law' + (kind === 'rema' ? ' is-rema' : '');
    sec.append(mk('div', 'vx-unit vx-law-head', key, label, s.n));
    const he = document.createElement('div'); he.className = 'hebrew-original vx-he'; he.lang = 'he'; he.dir = 'rtl';
    he.textContent = bs.map(b => b.he).join(' ');
    sec.append(he);
    bs.forEach(b => String(b.ru).split('\n\n').forEach((part, i, arr) => {
      const p = document.createElement('p'); p.className = 'law-text' + (kind === 'rema' ? ' rema' : '');
      p.innerHTML = (typeof marked === 'function' ? marked(part, true) : esc(part)) + (i === arr.length - 1 && b.source ? ` <span class="inline-source">(${esc(b.source)})</span>` : '');
      sec.append(p);
    }));
    return sec;
  }
  function comment(c) {
    if (!VOICE_URL || !ctx) return;
    const box = $('#commentContent'); if (!box) return;
    const el = mk('div', 'vx-unit vx-inline', `${ctx.data.chapter}_mb${c.n}`, 'Мишна Брура · ' + c.he, c.seif || ctx.s.n);
    box.prepend(el); paint(el);
  }

  /* ---------- отрисовка кнопок ---------- */
  function paintAll() {
    document.querySelectorAll('.vx-unit').forEach(paint);
    document.querySelectorAll('.vx-panel').forEach(p => {
      p.hidden = !REC && ![...p.querySelectorAll('.vx-unit')].some(u => !u.hidden);
      const pr = $('.vx-progress', p);
      if (pr && ctx) {
        const keys = allKeys(ctx.data), got = keys.filter(k => itemFor(k)).length;
        pr.textContent = `Записано в этой главе: ${got} из ${keys.length}`;
      }
    });
    paintBar();
  }
  function paint(el) {
    const key = el.dataset.vkey, c = $('.vx-ctrls', el), it = itemFor(key);
    const lock = !!(S.rec || S.pending || S.saving || S.error);
    let h = '';
    if (S.rec && S.rec.key === key) h = `<span class="vx-live">● идёт запись</span><time class="vx-time">${fmt((Date.now() - S.rec.start) / 1000)}</time><button type="button" data-vxbar="stop">■ Остановить</button>`;
    else if (S.pending && S.pending.key === key) {
      if (S.saving) h = '<span class="vx-note">Сохраняю на Диск…</span>';
      else if (S.error) h = `<span class="vx-note">${esc(S.error)}</span><button type="button" data-vxbar="retry">Повторить</button><button type="button" data-vxbar="drop">Не сохранять</button>`;
      else h = `<span class="vx-note">Запомнить запись?</span><button type="button" data-vxbar="listen">${S.preview ? '❚❚ Стоп' : '▶ Послушать'}</button><button type="button" class="vx-yes" data-vxbar="yes">Да, запомнить</button><button type="button" data-vxbar="no">Нет</button>`;
    }
    else {
      if (it) {
        const pl = S.playing && S.playing.key === key;
        h += `<button type="button" data-vx="play">${pl ? (S.playing.loading ? '… загрузка' : S.playing.paused ? '▶ Продолжить' : '❚❚ Пауза') : '▶ Воспроизвести'}</button>`;
      }
      if (REC) h += it
        ? `<button type="button" data-vx="rec" ${lock ? 'disabled' : ''}>● Перезаписать</button><button type="button" data-vx="del" ${lock ? 'disabled' : ''}>🗑 Стереть</button>`
        : `<button type="button" data-vx="rec" ${lock ? 'disabled' : ''}>● Записать</button>`;
    }
    c.innerHTML = h;
    el.hidden = !REC && !it;
  }
  const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const fullLabel = (key, label, seif) => `Гл. ${chOf(key)}${seif ? ', пункт ' + seif : ''} · ${label}`;

  function ensureBar() {
    if (bar || !REC) return;
    bar = document.createElement('div'); bar.id = 'vxBar'; bar.hidden = true;
    document.body.append(bar);
  }
  function paintBar() {
    if (!REC) return;
    ensureBar();
    let h = '';
    if (S.rec) h = `<span class="vx-live">● Запись</span><span>${esc(S.rec.title)}</span><time>${fmt((Date.now() - S.rec.start) / 1000)}</time><button type="button" data-vxbar="stop">■ Остановить</button>`;
    else if (S.saving) h = `<span>Сохраняю на Диск…</span><span>${esc(S.pending.title)}</span>`;
    else if (S.error) h = `<span>${esc(S.error)}</span><button type="button" data-vxbar="retry">Повторить</button><button type="button" data-vxbar="drop">Не сохранять</button>`;
    else if (S.pending) h = `<span>Запомнить запись?</span><span>${esc(S.pending.title)} · ${fmt(S.pending.dur)}</span><button type="button" data-vxbar="listen">${S.preview ? '❚❚ Стоп' : '▶ Послушать'}</button><button type="button" class="vx-yes" data-vxbar="yes">Да, запомнить</button><button type="button" data-vxbar="no">Нет</button>`;
    else if (S.flash) h = `<span>${esc(S.flash)}</span>`;
    bar.innerHTML = h; bar.hidden = !h;
  }
  function flash(msg) {
    S.flash = msg; paintBar(); clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { S.flash = ''; paintBar(); }, 2500);
  }

  /* ---------- воспроизведение ---------- */
  const urls = new Map();
  const b64blob = (b64, mime) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  };
  async function audioURL(key) {
    const it = itemFor(key), ck = `https://mb-voice.invalid/${key}?t=${it.t}`;
    if (urls.has(ck)) return urls.get(ck);
    let blob = null, cache = null;
    try { cache = await caches.open('mb-voice'); const r = await cache.match(ck); if (r) blob = await r.blob(); } catch (e) { }
    if (!blob) {
      const r = await fetch(`${VOICE_URL}?action=get&chapter=${chOf(key)}&key=${key}`);
      const j = await r.json();
      if (!j.ok) throw Error('get');
      blob = b64blob(j.data, j.mime);
      if (cache) try {
        for (const k of await cache.keys()) if (k.url.startsWith(`https://mb-voice.invalid/${key}?`)) await cache.delete(k);
        await cache.put(ck, new Response(blob, { headers: { 'Content-Type': j.mime } }));
      } catch (e) { }
    }
    const u = URL.createObjectURL(blob); urls.set(ck, u); return u;
  }
  function stopPlay() { audio.pause(); S.playing = null; }
  async function togglePlay(key) {
    if (S.playing && S.playing.key === key) {
      if (S.playing.loading) return;
      if (audio.paused) audio.play(); else audio.pause();
      return;
    }
    stopPlay(); S.playing = { key, loading: true, paused: false }; paintAll();
    try {
      audio.src = await audioURL(key);
      S.playing.loading = false;
      await audio.play();
    } catch (e) { S.playing = null; toast('Не удалось воспроизвести запись. Проверьте соединение.'); }
    paintAll();
  }
  audio.onpause = () => { if (S.playing && !audio.ended && !S.playing.loading) { S.playing.paused = true; paintAll(); } };
  audio.onplay = () => { if (S.playing) { S.playing.paused = false; paintAll(); } };
  audio.onended = () => { S.playing = null; paintAll(); };

  function toast(msg) {
    if (typeof window.notify === 'function') return window.notify(msg);
    if (REC) flash(msg); else alert(msg);
  }

  /* ---------- запись ---------- */
  const pass = () => { try { return localStorage.getItem('mb-voice-pass') || ''; } catch (e) { return ''; } };
  function askPass() {
    const p = prompt('Пароль для записи (вводится один раз на этом устройстве):');
    if (p) try { localStorage.setItem('mb-voice-pass', p.trim()); } catch (e) { }
    return pass();
  }
  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    return ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  };
  async function startRec(el) {
    if (S.rec || S.pending || S.saving || S.error) return;
    if (!pass() && !askPass()) return;
    stopPlay();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { toast('Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера.'); return; }
    const mime = pickMime(), chunks = [];
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : {}); }
    catch (e) { stream.getTracks().forEach(t => t.stop()); toast('Этот браузер не поддерживает запись звука.'); return; }
    const key = el.dataset.vkey, title = fullLabel(key, el.dataset.vlabel, el.dataset.vseif);
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(timer); if (wake) { try { wake.release(); } catch (e) { } wake = null; }
      const dur = (Date.now() - S.rec.start) / 1000, type = (rec.mimeType || mime || 'audio/mp4').split(';')[0];
      S.rec = null;
      const blob = new Blob(chunks, { type });
      if (dur < 1 || !blob.size) { toast('Запись слишком короткая — не сохранена.'); paintAll(); return; }
      S.pending = { key, title, blob, mime: type, dur };
      await idbPut(S.pending);
      paintAll();
    };
    rec.start(1000);
    S.rec = { key, title, start: Date.now(), recorder: rec };
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { }
    timer = setInterval(() => { paintBar(); if (S.rec) document.querySelectorAll('.vx-time').forEach(t => { t.textContent = fmt((Date.now() - S.rec.start) / 1000); }); }, 500);
    paintAll();
  }
  function stopRec() { if (S.rec && S.rec.recorder.state !== 'inactive') S.rec.recorder.stop(); }

  const toB64 = blob => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej; fr.readAsDataURL(blob);
  });
  async function post(body, retry = true) {
    body.pass = pass();
    const r = await fetch(VOICE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    const j = await r.json();
    if (!j.ok && j.error === 'auth') {
      try { localStorage.removeItem('mb-voice-pass'); } catch (e) { }
      if (retry && askPass()) return post(body, false);
      throw Error('Неверный пароль');
    }
    if (!j.ok) throw Error(j.message || j.error || 'Ошибка сервера');
    return j;
  }
  async function savePending() {
    const p = S.pending; if (!p || S.saving) return;
    stopPreview(); S.saving = true; S.error = ''; paintAll();
    try {
      const j = await post({ action: 'save', chapter: chOf(p.key), key: p.key, mime: p.mime, data: await toB64(p.blob) });
      setItem(p.key, { t: j.t, s: j.s, m: j.m });
      try { const c = await caches.open('mb-voice'); for (const k of await c.keys()) if (k.url.startsWith(`https://mb-voice.invalid/${p.key}?`)) await c.delete(k); } catch (e) { }
      S.pending = null; S.saving = false; await idbClear();
      flash('✓ Запись сохранена на Диск');
    } catch (e) {
      S.saving = false; S.error = 'Не удалось сохранить: ' + (e.message || 'нет соединения') + '. Запись не потеряна.';
    }
    paintAll();
  }
  async function dropPending() { stopPreview(); S.pending = null; S.error = ''; await idbClear(); paintAll(); }
  function stopPreview() { preview.pause(); S.preview = null; }
  function listen() {
    if (S.preview) { stopPreview(); paintAll(); return; }
    preview.src = URL.createObjectURL(S.pending.blob); S.preview = true; preview.play().catch(() => { S.preview = null; }); paintAll();
  }
  preview.onended = () => { S.preview = null; paintAll(); };

  async function deleteRec(el) {
    const key = el.dataset.vkey;
    if (!confirm(`Стереть запись?\n${fullLabel(key, el.dataset.vlabel, el.dataset.vseif)}`)) return;
    if (S.playing && S.playing.key === key) stopPlay();
    try {
      await post({ action: 'delete', chapter: chOf(key), key });
      setItem(key, null);
      try { const c = await caches.open('mb-voice'); for (const k of await c.keys()) if (k.url.startsWith(`https://mb-voice.invalid/${key}?`)) await c.delete(k); } catch (e) { }
      flash('Запись стёрта');
    } catch (e) { toast('Не удалось стереть: ' + (e.message || 'нет соединения')); }
    paintAll();
  }

  /* ---------- сохранение неотправленной записи (IndexedDB) ---------- */
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('mb-voice', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pending');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  async function idbPut(p) { try { const db = await idb(); db.transaction('pending', 'readwrite').objectStore('pending').put({ key: p.key, title: p.title, blob: p.blob, mime: p.mime, dur: p.dur }, 'p'); } catch (e) { } }
  async function idbClear() { try { const db = await idb(); db.transaction('pending', 'readwrite').objectStore('pending').delete('p'); } catch (e) { } }
  async function idbGet() { try { const db = await idb(); return await new Promise(res => { const q = db.transaction('pending').objectStore('pending').get('p'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }

  /* ---------- события ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-vx],[data-vxbar]'); if (!b) return;
    if (b.dataset.vxbar) {
      ({ stop: stopRec, yes: savePending, retry: savePending, no: dropPending, drop: dropPending, listen })[b.dataset.vxbar]();
      return;
    }
    const el = b.closest('.vx-unit'), key = el.dataset.vkey;
    if (b.dataset.vx === 'play') togglePlay(key);
    else if (b.dataset.vx === 'rec') startRec(el);
    else if (b.dataset.vx === 'del') deleteRec(el);
  });
  window.addEventListener('beforeunload', e => { if (S.rec || S.saving) { e.preventDefault(); e.returnValue = ''; } });
  if (REC) idbGet().then(p => { if (p && !S.pending) { S.pending = p; paintAll(); } });

  window.Voice = { render, comment, enabled: !!VOICE_URL };
})();
