/**
 * Admin panel core: GitHub access, saving, publishing status and small UI helpers
 * shared by every section.
 *
 * Content lives in the GitHub repository (data/*.json, images, the PDF catalog).
 * Every save is one commit; the "Build site" workflow then regenerates the pages
 * and writes build-info.json, which tells the panel when the change is live.
 */
import { STRINGS } from '../assets/js/strings.js';
import { esc } from '../assets/js/card.js';

export { esc };
export const KA = STRINGS.ka;
export const CATS = KA.categories;
export const REPO = 'sandomiweb/sandomi-site';
export const BRANCH = 'main';
const API = 'https://api.github.com';
const TOKEN_KEY = 'sandomi_admin_token';
const TRANSLATE_EMAIL = 'sandomi.marketing@gmail.com';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const main = $('#main');

/* ================================================================== token */

export const auth = { token: '' };
try {
  auth.token = localStorage.getItem(TOKEN_KEY) || '';
} catch {
  /* storage unavailable: ask every time */
}
export function rememberToken(token) {
  auth.token = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* session only */
  }
}

/* ================================================================= GitHub */

export class GitHubError extends Error {}

export async function gh(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: 'application/vnd.github+json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GitHubError('ინტერნეტთან კავშირი ვერ მოხერხდა.');
  }
  if (!res.ok) {
    const err = new GitHubError(
      res.status === 401
        ? 'გასაღები არასწორია ან ვადა გაუვიდა.'
        : res.status === 403 || res.status === 404
          ? 'გასაღებს ამ საიტის შეცვლის უფლება არ აქვს.'
          : `GitHub-ის შეცდომა (${res.status}).`,
    );
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const textFromB64 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export async function readText(path, ref = BRANCH) {
  const f = await gh(`/repos/${REPO}/contents/${path}?ref=${ref}`);
  if (f.content) return textFromB64(f.content);
  const blob = await gh(`/repos/${REPO}/git/blobs/${f.sha}`); // files over 1 MB
  return textFromB64(blob.content);
}

/** Names of the files in a repository folder (for picking existing images). */
export async function listDir(path) {
  const list = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
  return list.filter((f) => f.type === 'file').map((f) => f.path);
}

/**
 * One commit with several files.
 * file: {path, text} | {path, base64} | {path, sha} (reuse an existing blob)
 */
export async function commit(message, files) {
  const blobs = [];
  for (const f of files) {
    if (f.sha) {
      blobs.push({ path: f.path, sha: f.sha });
      continue;
    }
    const blob = await gh(`/repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: f.base64 != null ? { content: f.base64, encoding: 'base64' } : { content: f.text, encoding: 'utf-8' },
    });
    blobs.push({ path: f.path, sha: blob.sha });
  }
  for (let attempt = 0; ; attempt++) {
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const head = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);
    const tree = await gh(`/repos/${REPO}/git/trees`, {
      method: 'POST',
      body: {
        base_tree: head.tree.sha,
        tree: blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
      },
    });
    const c = await gh(`/repos/${REPO}/git/commits`, {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [ref.object.sha] },
    });
    try {
      await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: c.sha } });
      return c.sha;
    } catch (e) {
      // The branch moved meanwhile (usually the build workflow): retry on top of it.
      if (e.status !== 422 || attempt >= 3) throw e;
    }
  }
}

/* ============================================================ data files */

/** data/*.json files loaded in this session. */
export const data = {};

export async function loadJson(path) {
  data[path] = JSON.parse(await readText(path));
  return data[path];
}

export const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';

/**
 * Save a data file (plus extra files such as new photos) as one commit, then
 * follow publishing. Throws (after telling the user) when saving fails.
 */
export async function saveJson(path, value, message, extra = []) {
  const text = jsonText(value);
  setStatus('busy', 'ინახება…');
  try {
    await commit(message, [...extra, { path, text }]);
  } catch (e) {
    setStatus('fail', 'ვერ შეინახა');
    toast(e.message);
    throw e;
  }
  data[path] = value;
  watchBuild(path, text);
}

/* ========================================================= publish status */

let statusTimer;
export function setStatus(kind, text) {
  const s = $('#status');
  s.className = 'status' + (kind === 'done' ? ' done' : kind === 'fail' ? ' fail' : '');
  s.textContent = text;
  s.hidden = false;
  clearTimeout(statusTimer);
  if (kind === 'done') statusTimer = setTimeout(() => (s.hidden = true), 6000);
}

async function sha1(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let watchId = 0;
/** Wait until the live site was rebuilt from what we saved (build-info.json). */
export async function watchBuild(path, text) {
  const id = ++watchId;
  setStatus('busy', 'ქვეყნდება საიტზე… (2–3 წუთი)');
  const want = await sha1(text);
  for (let i = 0; i < 72 && id === watchId; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const info = await fetch(`../build-info.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json());
      if (info[path] === want) {
        if (id === watchId) setStatus('done', '✓ საიტზე გამოქვეყნდა');
        return;
      }
    } catch {
      /* keep waiting */
    }
  }
  if (id === watchId) setStatus('done', '✓ შენახულია · საიტზე მალე გამოჩნდება');
}

/** For files the build does not hash (the PDF): wait until the live file has the new size. */
export async function watchFileSize(path, size) {
  const id = ++watchId;
  setStatus('busy', 'ქვეყნდება საიტზე… (1–2 წუთი)');
  for (let i = 0; i < 60 && id === watchId; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const res = await fetch(`../${path}?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      if (Number(res.headers.get('content-length')) === size) {
        if (id === watchId) setStatus('done', '✓ საიტზე გამოქვეყნდა');
        return;
      }
    } catch {
      /* keep waiting */
    }
  }
  if (id === watchId) setStatus('done', '✓ შენახულია · საიტზე მალე გამოჩნდება');
}

/* ================================================================= toast */

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}

/* ============================================================ translation */

/** Machine translation (MyMemory, free, no key). The result is only a suggestion. */
export async function translate(text, to) {
  if (!text.trim()) return '';
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    `&langpair=ka|${to}&de=${encodeURIComponent(TRANSLATE_EMAIL)}`;
  const res = await fetch(url);
  const j = await res.json();
  const out = j?.responseData?.translatedText;
  if (Number(j?.responseStatus) !== 200 || !out) throw new Error('translation failed');
  const d = document.createElement('textarea');
  d.innerHTML = out; // decode &quot; etc.
  return d.value;
}

/** Translate several texts (paragraphs) one by one, keeping empty ones empty. */
export async function translateAll(texts, to) {
  const out = [];
  for (const t of texts) out.push(t.trim() ? await translate(t, to) : '');
  return out;
}

/* ============================================================== photos */

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Resize a photo in the browser and encode it as WebP (JPEG where the browser cannot).
 * mode "fit": fixed w×h canvas on white (product photos).
 * mode "max": keep proportions, longest side ≤ max; transparency is kept.
 */
export async function preparePhoto(file, { mode = 'max', w = 720, h = 540, max = 1400 } = {}) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (mode === 'fit') {
    const s = Math.min(w / bmp.width, h / bmp.height, 1);
    c.width = w;
    c.height = h;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(bmp, (w - bmp.width * s) / 2, (h - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
  } else {
    const s = Math.min(max / Math.max(bmp.width, bmp.height), 1);
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    g.drawImage(bmp, 0, 0, c.width, c.height);
  }
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((r) => c.toBlob(r, mode === 'fit' ? 'image/jpeg' : 'image/png', 0.88));
    ext = mode === 'fit' ? 'jpg' : 'png';
  }
  return { base64: toBase64(new Uint8Array(await blob.arrayBuffer())), url: URL.createObjectURL(blob), ext };
}

export async function fileBase64(file) {
  return toBase64(new Uint8Array(await file.arrayBuffer()));
}

const TR = {
  ა: 'a',
  ბ: 'b',
  გ: 'g',
  დ: 'd',
  ე: 'e',
  ვ: 'v',
  ზ: 'z',
  თ: 't',
  ი: 'i',
  კ: 'k',
  ლ: 'l',
  მ: 'm',
  ნ: 'n',
  ო: 'o',
  პ: 'p',
  ჟ: 'zh',
  რ: 'r',
  ს: 's',
  ტ: 't',
  უ: 'u',
  ფ: 'f',
  ქ: 'k',
  ღ: 'gh',
  ყ: 'q',
  შ: 'sh',
  ჩ: 'ch',
  ც: 'ts',
  ძ: 'dz',
  წ: 'ts',
  ჭ: 'ch',
  ხ: 'kh',
  ჯ: 'j',
  ჰ: 'h',
};
/** "ვაფლი კაკაოს კრემით" → "vafli-kakaos-kremit" */
export const slug = (s) =>
  [...String(s).toLowerCase()]
    .map((c) => TR[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A new, unused file name like assets/img/gallery/exp-20261119-1042-1.webp */
let fileSeq = 0;
export function newFileName(dir, base, ext) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dir}${base ? base + '-' : ''}${stamp}-${++fileSeq}.${ext}`;
}

/** Image src for a repository path; new uploads show their local preview. */
export const pending = new Map(); // repo path → {base64, url}
export const imgUrl = (path) => (!path ? '' : pending.get(path)?.url || (/^https?:/.test(path) ? path : `../${path}`));

/** Extra files to commit for the given image paths that were uploaded in this editor. */
export function pendingFiles(paths) {
  return [...new Set(paths)].filter((p) => pending.has(p)).map((p) => ({ path: p, base64: pending.get(p).base64 }));
}

/* ============================================================ UI helpers */

export const LANGS = [
  ['ka', 'KA'],
  ['en', 'EN'],
  ['ru', 'RU'],
];

/**
 * Georgian field + English and Russian, with a "translate" button.
 * Read back with readI18n(id).
 */
export function i18nField(id, label, value = {}, { multiline = false, hint = '' } = {}) {
  const v = typeof value === 'string' ? { ka: value } : value || {};
  const input = (lang) =>
    multiline
      ? `<textarea class="in" rows="3" id="${id}-${lang}">${esc(v[lang] || '')}</textarea>`
      : `<input class="in" id="${id}-${lang}" value="${esc(v[lang] || '')}" />`;
  return `<div class="i18n" data-i18n="${id}">
      <label for="${id}-ka">${esc(label)}</label>
      ${hint ? `<small class="hint">${esc(hint)}</small>` : ''}
      ${input('ka')}
      <div class="tr"><span class="flag">EN</span>${input('en')}</div>
      <div class="tr"><span class="flag">RU</span>${input('ru')}</div>
      <div class="tr"><button type="button" class="auto" data-tr="${id}">✨ თარგმნა</button></div>
    </div>`;
}

/**
 * English / Russian that were not touched after the Georgian text changed count
 * as empty, so saving translates them again instead of keeping an old text.
 */
export const readI18n = (id, root = main) => {
  const out = {};
  for (const [l] of LANGS) {
    const el = $(`#${id}-${l}`, root);
    out[l] = el.dataset.stale ? '' : el.value.trim();
  }
  return out;
};

/** Mark translations stale when the Georgian text changes (see readI18n). */
export function watchStale(ka, others) {
  ka.addEventListener('input', () =>
    others.forEach((o) => {
      if (o.value) {
        o.dataset.stale = '1';
        o.title = 'ქართული ტექსტი შეიცვალა — შენახვისას თავიდან ითარგმნება';
      }
    }),
  );
  others.forEach((o) =>
    o.addEventListener('input', () => {
      delete o.dataset.stale;
      o.title = '';
    }),
  );
}

/** Wire every "✨ თარგმნა" button inside root. */
export function wireTranslate(root = main) {
  $$('[data-i18n]', root).forEach((box) => {
    const id = box.dataset.i18n;
    watchStale($(`#${id}-ka`, box), [$(`#${id}-en`, box), $(`#${id}-ru`, box)]);
  });
  $$('[data-tr]', root).forEach(
    (btn) =>
      (btn.onclick = async () => {
        const id = btn.dataset.tr;
        const ka = $(`#${id}-ka`, root).value;
        if (!ka.trim()) return toast('ჯერ ქართული ტექსტი ჩაწერე.');
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = '✨ ითარგმნება…';
        try {
          for (const lang of ['en', 'ru']) {
            // translate paragraph by paragraph, so line breaks survive
            const parts = await translateAll(ka.split(/\n/), lang);
            const el = $(`#${id}-${lang}`, root);
            el.value = parts.join('\n');
            delete el.dataset.stale;
            el.title = '';
          }
        } catch {
          toast('თარგმანი ახლა ვერ მოხერხდა. ჩაწერე ხელით ან სცადე მოგვიანებით.');
        }
        btn.disabled = false;
        btn.textContent = label;
      }),
  );
}

/** Fill empty English / Russian fields automatically before saving (best effort). */
export async function fillMissing(value) {
  for (const lang of ['en', 'ru']) {
    if (value.ka && !value[lang]) {
      try {
        value[lang] = (await translateAll(value.ka.split(/\n/), lang)).join('\n');
      } catch {
        /* the site falls back to Georgian */
      }
    }
  }
  return value;
}

/** Disable a save button while saving; restore it when done. */
export async function busy(button, fn) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'ინახება…';
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/** Ask a file from the user. */
export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

export const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
};

export function header(title, sub, actions = '') {
  return `<div class="top"><div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>${actions}</div>`;
}

export const tKa = (v) => (typeof v === 'string' ? v : v?.ka || '');

/** Navigation between sections (set by admin.js). */
export const nav = { go: () => {} };

const MONTHS_KA = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];
/** "19 ნოემბერი 2026, 10:42" — written out, because not every browser knows Georgian dates. */
export function dateKa(value, { time = false, year = true } = {}) {
  const d = new Date(value);
  if (isNaN(d)) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${MONTHS_KA[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}${time ? `, ${hm}` : ''}`;
}
