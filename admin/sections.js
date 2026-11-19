/**
 * Admin sections for data/content.json (seasonal banners, videos, gallery,
 * site texts, news), the chatbot (data/chatbot.json) and the PDF catalog.
 */
import {
  $,
  $$,
  main,
  esc,
  CATS,
  REPO,
  BRANCH,
  gh,
  commit,
  data,
  loadJson,
  saveJson,
  toast,
  setStatus,
  watchFileSize,
  preparePhoto,
  fileBase64,
  newFileName,
  pending,
  imgUrl,
  pendingFiles,
  i18nField,
  readI18n,
  wireTranslate,
  fillMissing,
  busy,
  pickFile,
  move,
  header,
  tKa,
  listDir,
  nav,
  watchStale,
  dateKa,
} from './core.js';
import { SEASON_THEMES, seasonActive, youtubeId } from '../tools/content.mjs';

const CONTENT = 'data/content.json';
const CHATBOT = 'data/chatbot.json';
const PDF = 'catalog/sandomi-catalog-2026.pdf';

export const loadContent = () => Promise.all([loadJson(CONTENT), loadJson(CHATBOT)]);

/** Save a modified copy of content.json. */
async function saveContent(draft, message, imagePaths = []) {
  await saveJson(CONTENT, draft, message, pendingFiles(imagePaths));
}

const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const mdLabel = (md) => (md ? `${Number(md.slice(3))} ${MONTHS[Number(md.slice(0, 2)) - 1]}` : '');
const FILTERS = { all: 'ყველა პროდუქცია', lent: '🌿 სამარხვო', ...CATS };

/* ======================================================= seasonal banners */

const THEME_LOOK = {
  winter: { label: 'ზამთარი', bg: 'linear-gradient(135deg,#0f2a4a,#1d4f86 55%,#3a78bd)' },
  easter: { label: 'აღდგომა', bg: 'linear-gradient(160deg,#f6c64d,#f39fb0)', dark: true },
  lent: { label: 'მარხვა', bg: 'linear-gradient(135deg,#1f4d2b,#2f6b3a 55%,#6fae5c)' },
  love: { label: 'სიყვარული', bg: 'linear-gradient(135deg,#8a0b24,#c8102e 55%,#f07a8c)' },
  gold: { label: 'ზეიმი', bg: 'linear-gradient(135deg,#5c0718,#8a0b24 50%,#c98a1b)' },
  custom: { label: 'საკუთარი ფერი', bg: '' },
};
const bannerBg = (b) =>
  b.theme === 'custom'
    ? `linear-gradient(135deg,${b.colors?.[0] || '#5c0718'},${b.colors?.[1] || '#c8102e'})`
    : (THEME_LOOK[b.theme] || THEME_LOOK.winter).bg;

function bannerStatus(b, list) {
  const live = list.find((x) => seasonActive(x));
  if (!b.on) return '<span class="st draft">გამორთულია</span>';
  if (b === live) return '<span class="st live">● ახლა საიტზეა</span>';
  if (seasonActive(b)) return '<span class="st plan">ელოდება (წინა ბანერი ჩანს)</span>';
  return '<span class="st plan">დაგეგმილი</span>';
}

export function renderSeason() {
  const list = data[CONTENT].season;
  main.innerHTML = `
    ${header('სეზონური ბანერი', 'მოამზადე ბანერები წინასწარ — საიტი თარიღების მიხედვით თვითონ ჩართავს', '<button class="btn red ml" id="add">＋ ახალი ბანერი</button>')}
    <div class="card">${
      list.length
        ? list
            .map(
              (b, i) => `<div class="hrow">
          <span class="th" style="background:${bannerBg(b)}"></span>
          <div><b>${esc(tKa(b.title) || 'უსათაურო')}</b><div>${bannerStatus(b, list)}</div>
          <div class="when">${b.from && b.to ? `${mdLabel(b.from)} — ${mdLabel(b.to)} · ყოველ წელს` : 'თარიღის გარეშე — ჩანს მუდმივად, სანამ ჩართულია'}</div></div>
          <span class="ml row-actions">
            <button class="ico" data-up="${i}" title="ზემოთ">↑</button><button class="ico" data-down="${i}" title="ქვემოთ">↓</button>
            <button class="btn ghost" data-copy="${i}">ასლი</button><button class="edit" data-edit="${i}">✎ შეცვლა</button>
          </span></div>`,
            )
            .join('')
        : '<div class="empty">ბანერი ჯერ არ არის</div>'
    }</div>
    <div class="note">💡 თუ ერთ დღეს რამდენიმე ბანერი ემთხვევა, საიტზე სიაში ზედა ჩანს. შემდეგ წელს იგივე ბანერი თავისით ჩაირთვება — თარიღები ყოველ წელს მეორდება. „ასლით“ ბანერის ახალ ვერსიას გააკეთებ.</div>`;

  $('#add').onclick = () =>
    renderSeasonEditor(-1, {
      id: `b${Date.now()}`,
      on: true,
      from: '',
      to: '',
      theme: 'easter',
      eyebrow: { ka: 'სეზონის შეთავაზება', en: 'Seasonal offer', ru: 'Сезонное предложение' },
      title: {},
      text: {},
      button: { ka: 'პროდუქციის ნახვა →', en: 'View products →', ru: 'Смотреть продукцию →' },
      filter: 'all',
      images: [],
      bear: true,
    });
  $$('[data-edit]').forEach((b) => (b.onclick = () => renderSeasonEditor(+b.dataset.edit)));
  $$('[data-copy]').forEach(
    (b) =>
      (b.onclick = () => {
        const copy = structuredClone(list[+b.dataset.copy]);
        copy.id = `b${Date.now()}`;
        copy.on = false;
        copy.title.ka = (copy.title.ka || '') + ' (ასლი)';
        renderSeasonEditor(-1, copy);
      }),
  );
  const reorder = async (i, d) => {
    const draft = structuredClone(data[CONTENT]);
    move(draft.season, i, d);
    try {
      await saveContent(draft, 'ბანერების რიგი შეიცვალა');
    } catch {
      /* told already */
    }
    renderSeason();
  };
  $$('[data-up]').forEach((b) => (b.onclick = () => reorder(+b.dataset.up, -1)));
  $$('[data-down]').forEach((b) => (b.onclick = () => reorder(+b.dataset.down, 1)));
}

const mdToDate = (md) => (md ? `2026-${md}` : '');
const dateToMd = (v) => (v ? v.slice(5) : '');

function renderSeasonEditor(index, banner) {
  const b = structuredClone(banner || data[CONTENT].season[index]);
  b.images = [...(b.images || [])];
  const isNew = index < 0;

  main.innerHTML = `
    <div class="crumb"><button id="back">სეზონური ბანერი</button> › <b>${isNew ? 'ახალი ბანერი' : 'რედაქტირება'}</b></div>
    ${header(tKa(b.title) || 'ახალი ბანერი')}
    <div class="grid2 wide-left">
      <div class="card sec sticky">
        <div class="lbl" style="margin-top:0">👁️ ასე გამოჩნდება საიტზე</div>
        <div class="pv" id="pv"></div>
        <div class="lbl">ფოტოები (3-მდე) — საუკეთესოა გამჭვირვალე ფონზე (PNG)</div>
        <div class="slots" id="slots"></div>
        <label class="sw"><div><b>🧸 დათუნია</b><small>შუაში, ფოტოებს შორის</small></div><input type="checkbox" class="tg" id="bear" ${b.bear !== false ? 'checked' : ''}></label>
      </div>
      <form class="card sec" id="ed" novalidate>
        <label class="sw" style="padding-top:0"><div><b>ჩართულია</b><small>გამორთული ბანერი საიტზე არ ჩანს</small></div><input type="checkbox" class="tg red" id="on" ${b.on ? 'checked' : ''}></label>
        <div class="row">
          <div><label for="from">ჩაირთოს</label><input class="in" type="date" id="from" value="${mdToDate(b.from)}"></div>
          <div><label for="to">გამოირთოს</label><input class="in" type="date" id="to" value="${mdToDate(b.to)}"></div>
          <div><label>&nbsp;</label><button type="button" class="btn ghost" id="always" style="width:100%">მუდმივად</button></div>
        </div>
        <small class="hint">თარიღები ყოველ წელს მეორდება. ცარიელი თარიღი = ჩანს მუდმივად.</small>
        <span class="lbl">ფერი</span>
        <div class="colors" id="themes">${Object.entries(THEME_LOOK)
          .map(
            ([k, v]) =>
              `<button type="button" class="sw2${b.theme === k ? ' on' : ''}" data-theme="${k}" title="${v.label}" style="background:${k === 'custom' ? 'conic-gradient(#c8102e,#f5b335,#2f6b3a,#1d4f86,#c8102e)' : v.bg}"></button>`,
          )
          .join('')}</div>
        <div class="row" id="customColors" ${b.theme === 'custom' ? '' : 'hidden'}>
          <div><label for="c1">ფერი 1</label><input class="in color" type="color" id="c1" value="${esc(b.colors?.[0] || '#5c0718')}"></div>
          <div><label for="c2">ფერი 2</label><input class="in color" type="color" id="c2" value="${esc(b.colors?.[1] || '#c8102e')}"></div>
          <div><label class="sw" style="border:0"><div><b>მუქი ტექსტი</b><small>ღია ფერზე</small></div><input type="checkbox" class="tg" id="dark" ${b.dark ? 'checked' : ''}></label></div>
        </div>
        ${i18nField('eyebrow', 'პატარა სათაური', b.eyebrow)}
        ${i18nField('title', 'სათაური', b.title)}
        ${i18nField('text', 'ტექსტი', b.text, { multiline: true })}
        ${i18nField('button', 'ღილაკის ტექსტი', b.button, { hint: 'ცარიელი = ღილაკი არ გამოჩნდება' })}
        <label for="filter">ღილაკი გადადის</label>
        <select class="in" id="filter">${Object.entries(FILTERS)
          .map(([k, v]) => `<option value="${k}"${k === b.filter ? ' selected' : ''}>${esc(v)}</option>`)
          .join('')}</select>
        <div class="foot">
          <button class="btn red" type="submit" id="save">✓ შენახვა</button>
          <button class="btn ghost" type="button" id="cancel">გაუქმება</button>
          ${isNew ? '' : '<button class="btn danger ml" type="button" id="del">წაშლა</button>'}
        </div>
      </form>
    </div>`;

  const back = () => nav.go('season');
  $('#back').onclick = back;
  $('#cancel').onclick = back;
  wireTranslate();

  const read = () => {
    b.on = $('#on').checked;
    b.from = dateToMd($('#from').value);
    b.to = dateToMd($('#to').value);
    if (!b.from || !b.to) b.from = b.to = '';
    b.eyebrow = readI18n('eyebrow');
    b.title = readI18n('title');
    b.text = readI18n('text');
    b.button = readI18n('button');
    b.filter = $('#filter').value;
    b.bear = $('#bear').checked;
    if (b.theme === 'custom') {
      b.colors = [$('#c1').value, $('#c2').value];
      b.dark = $('#dark').checked;
    } else {
      delete b.colors;
      delete b.dark;
    }
    return b;
  };

  const preview = () => {
    read();
    const dark = b.theme === 'easter' || (b.theme === 'custom' && b.dark);
    $('#pv').className = 'pv' + (dark ? ' dark' : '');
    $('#pv').style.background = bannerBg(b);
    $('#pv').innerHTML = `
      <div class="pv-txt"><div class="pv-ey">${esc(b.eyebrow.ka)}</div><h2>${esc(b.title.ka || 'სათაური')}</h2><p>${esc(b.text.ka)}</p>
      ${b.button.ka ? `<span class="pv-btn">${esc(b.button.ka)}</span>` : ''}</div>
      <div class="pv-art">${b.images
        .filter(Boolean)
        .slice(0, 3)
        .map((src, i) => `<img class="sp${i + 1}" src="${esc(imgUrl(src))}" alt="">`)
        .join('')}${b.bear ? '<img class="bear" src="../assets/img/teddy.webp" alt="">' : ''}</div>`;
  };

  const slots = () => {
    $('#slots').innerHTML = [0, 1, 2]
      .map(
        (i) => `<div class="slot">${b.images[i] ? `<img src="${esc(imgUrl(b.images[i]))}" alt="">` : '<span>＋</span>'}
        <div class="slot-a"><button type="button" class="ico" data-pick="${i}">${b.images[i] ? '🔄' : '＋'}</button>${b.images[i] ? `<button type="button" class="ico" data-rm="${i}">✕</button>` : ''}</div></div>`,
      )
      .join('');
    $$('[data-pick]').forEach(
      (x) =>
        (x.onclick = async () => {
          const src = await chooseImage(['assets/img/hero/', 'assets/img/season/'], 'assets/img/season/', { max: 900 });
          if (!src) return;
          b.images[+x.dataset.pick] = src;
          b.images = b.images.filter(Boolean);
          slots();
          preview();
        }),
    );
    $$('[data-rm]').forEach(
      (x) =>
        (x.onclick = () => {
          b.images.splice(+x.dataset.rm, 1);
          slots();
          preview();
        }),
    );
  };

  $$('#themes [data-theme]').forEach(
    (t) =>
      (t.onclick = () => {
        b.theme = t.dataset.theme;
        $$('#themes .sw2').forEach((x) => x.classList.toggle('on', x === t));
        $('#customColors').hidden = b.theme !== 'custom';
        preview();
      }),
  );
  $('#always').onclick = () => {
    $('#from').value = $('#to').value = '';
    preview();
  };
  $('#ed').addEventListener('input', preview);
  $('#bear').onchange = preview;
  slots();
  preview();

  if (!isNew)
    $('#del').onclick = async () => {
      if (!confirm('წავშალო ეს ბანერი? თუ მომავალ წელს დაგჭირდება, ჯობია უბრალოდ გამორთო.')) return;
      const draft = structuredClone(data[CONTENT]);
      draft.season.splice(index, 1);
      try {
        await saveContent(draft, `ბანერი წაიშალა: ${tKa(b.title)}`);
        toast('✓ წაიშალა');
        back();
      } catch {
        /* told already */
      }
    };

  $('#ed').onsubmit = async (e) => {
    e.preventDefault();
    read();
    if (!b.title.ka) {
      $('#title-ka').classList.add('bad');
      $('#title-ka').focus();
      return toast('ჩაწერე სათაური.');
    }
    if (!!$('#from').value !== !!$('#to').value) return toast('მიუთითე ორივე თარიღი, ან არცერთი.');
    await busy($('#save'), async () => {
      for (const k of ['eyebrow', 'title', 'text', 'button']) await fillMissing(b[k]);
      const draft = structuredClone(data[CONTENT]);
      if (isNew) draft.season.push(b);
      else draft.season[index] = b;
      try {
        await saveContent(draft, `ბანერი: ${b.title.ka}`, b.images);
        toast('✓ შენახულია');
        back();
      } catch {
        /* told already */
      }
    });
  };
}

/**
 * Pick an image from repository folders or upload a new one.
 * Resolves to a repository path (a new upload stays in `pending` until saved).
 */
async function chooseImage(dirs, uploadDir, opts) {
  const files = [];
  for (const d of dirs) {
    try {
      files.push(...(await listDir(d)).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)));
    } catch {
      /* folder may not exist yet */
    }
  }
  return new Promise((resolve) => {
    const dlg = document.createElement('div');
    dlg.className = 'dlg';
    dlg.innerHTML = `<div class="dlg-in card">
      <div class="top"><h1 style="font-size:20px">აირჩიე ფოტო</h1><button class="btn red ml" id="dUp">⬆ ახლის ატვირთვა</button><button class="btn ghost" id="dX">✕</button></div>
      <div class="pick">${files.map((f) => `<button data-f="${esc(f)}"><img src="${esc(imgUrl(f))}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
    document.body.append(dlg);
    const done = (v) => {
      dlg.remove();
      resolve(v);
    };
    $('#dX', dlg).onclick = () => done('');
    dlg.onclick = (e) => e.target === dlg && done('');
    $$('[data-f]', dlg).forEach((b) => (b.onclick = () => done(b.dataset.f)));
    $('#dUp', dlg).onclick = async () => {
      const [f] = await pickFile('image/*');
      if (!f) return;
      try {
        const ph = await preparePhoto(f, { mode: 'max', ...opts });
        const path = newFileName(uploadDir, '', ph.ext);
        pending.set(path, ph);
        done(path);
      } catch {
        toast('ეს ფოტო ვერ წავიკითხე. სცადე JPG ან PNG.');
      }
    };
  });
}

/* ================================================================ videos */

export function renderVideos() {
  const v = structuredClone(data[CONTENT].videos);
  const thumb = (x) => (x.cover ? imgUrl(x.cover) : `https://i.ytimg.com/vi/${youtubeId(x.url)}/mqdefault.jpg`);
  const draw = () => {
    main.innerHTML = `
      ${header('ვიდეოები', 'YouTube-ის ვიდეოები „წარმოება და ხარისხი“ სექციაში')}
      <form id="ed" novalidate>
      <div class="card sec">
        <h3>მთავარი ვიდეო</h3>
        <label for="mainUrl">YouTube ლინკი</label><input class="in" id="mainUrl" value="${esc(v.main.url)}" placeholder="https://youtu.be/…">
        ${i18nField('mainTitle', 'სათაური', v.main.title)}
      </div>
      <div class="card sec" style="margin-top:18px">
        <h3>ვიდეოების ზოლი</h3>
        <div class="vlist">${v.list
          .map(
            (x, i) => `<div class="vrow">
            <img class="vth" src="${esc(thumb(x))}" alt="">
            <div class="vf">
              <input class="in" data-url="${i}" value="${esc(x.url)}" placeholder="https://youtu.be/…">
              <div class="tr3"><input class="in" data-t="${i}" data-l="ka" value="${esc(x.title?.ka || '')}" placeholder="სათაური"><input class="in" data-t="${i}" data-l="en" value="${esc(x.title?.en || '')}" placeholder="EN"><input class="in" data-t="${i}" data-l="ru" value="${esc(x.title?.ru || '')}" placeholder="RU"></div>
              ${x.cover ? `<button type="button" class="linkbtn" data-nocover="${i}">ფოტოს ნაცვლად YouTube-ის კადრი</button>` : ''}
            </div>
            <span class="row-actions"><button type="button" class="ico" data-up="${i}">↑</button><button type="button" class="ico" data-down="${i}">↓</button><button type="button" class="ico" data-rm="${i}">✕</button></span>
          </div>`,
          )
          .join('')}</div>
        <button type="button" class="btn ghost" id="add" style="margin-top:14px">＋ ვიდეოს დამატება</button>
      </div>
      <div class="foot"><button class="btn red" type="submit" id="save">✓ შენახვა</button></div>
      </form>`;
    wireTranslate();
    v.list.forEach((x, i) =>
      watchStale($(`[data-t="${i}"][data-l="ka"]`), [
        $(`[data-t="${i}"][data-l="en"]`),
        $(`[data-t="${i}"][data-l="ru"]`),
      ]),
    );
    const sync = () => {
      v.main.url = $('#mainUrl').value.trim();
      v.main.title = readI18n('mainTitle');
      $$('[data-url]').forEach((x) => (v.list[+x.dataset.url].url = x.value.trim()));
      $$('[data-t]').forEach((x) => {
        const item = v.list[+x.dataset.t];
        item.title = { ...(item.title || {}), [x.dataset.l]: x.dataset.stale ? '' : x.value.trim() };
      });
    };
    const redraw = (fn) => () => {
      sync();
      fn();
      draw();
    };
    $('#add').onclick = redraw(() => v.list.push({ url: '', title: { ka: 'სანდომი', en: 'Sandomi', ru: 'Сандоми' } }));
    $$('[data-rm]').forEach((b) => (b.onclick = redraw(() => v.list.splice(+b.dataset.rm, 1))));
    $$('[data-up]').forEach((b) => (b.onclick = redraw(() => move(v.list, +b.dataset.up, -1))));
    $$('[data-down]').forEach((b) => (b.onclick = redraw(() => move(v.list, +b.dataset.down, 1))));
    $$('[data-nocover]').forEach((b) => (b.onclick = redraw(() => delete v.list[+b.dataset.nocover].cover)));
    $$('[data-url]').forEach(
      (x) =>
        (x.onchange = () => {
          const id = youtubeId(x.value);
          const img = x.closest('.vrow').querySelector('.vth');
          if (id && !v.list[+x.dataset.url].cover) img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
        }),
    );
    $('#ed').onsubmit = async (e) => {
      e.preventDefault();
      sync();
      v.list = v.list.filter((x) => x.url);
      const bad = [v.main, ...v.list].find((x) => x.url && !youtubeId(x.url));
      if (bad) return toast(`ეს არ არის YouTube-ის ლინკი: ${bad.url}`);
      await busy($('#save'), async () => {
        await fillMissing(v.main.title);
        for (const x of v.list) await fillMissing(x.title || (x.title = {}));
        const draft = structuredClone(data[CONTENT]);
        draft.videos = v;
        try {
          await saveContent(draft, 'ვიდეოები განახლდა');
          toast('✓ შენახულია');
          draw();
        } catch {
          /* told already */
        }
      });
    };
  };
  draw();
}

/* =============================================================== gallery */

const GAL_ICONS = { globe: '🌍', tv: '📺', heart: '❤️', camera: '📷', star: '⭐' };

export function renderGallery(tabIndex = 0) {
  const g = structuredClone(data[CONTENT].gallery);
  let cur = Math.min(tabIndex, g.length - 1);
  const draw = () => {
    const tab = g[cur];
    main.innerHTML = `
      ${header('ფოტოგალერეა', '„სანდომი ახლოდან“ — ფოტოები განყოფილებების მიხედვით', '<button class="btn red ml" id="save">✓ შენახვა</button>')}
      <div class="bar">${g
        .map(
          (t, i) =>
            `<button class="chip${i === cur ? ' on' : ''}" data-tab="${i}">${GAL_ICONS[t.icon] || '📷'} ${esc(t.title.ka)} (${t.photos.length})</button>`,
        )
        .join('')}<button class="chip" id="newTab">＋ განყოფილება</button></div>
      ${
        tab
          ? `<div class="card sec">
        <div class="top" style="margin-bottom:8px"><h3 style="margin:0">${esc(tab.title.ka)}</h3>
          <span class="ml row-actions"><button class="ico" id="tabUp" title="მარცხნივ">←</button><button class="ico" id="tabDown" title="მარჯვნივ">→</button></span>
          <button class="btn red" id="addPh">⬆ ფოტოების დამატება</button></div>
        <div class="gal-grid">${tab.photos
          .map(
            (p, i) => `<figure class="gph"><img src="${esc(imgUrl(p.src))}" alt="" loading="lazy">
            <div class="slot-a"><button class="ico" data-l="${i}" title="წინ">←</button><button class="ico" data-r="${i}" title="უკან">→</button><button class="ico" data-rm="${i}" title="წაშლა">✕</button></div></figure>`,
          )
          .join('')}</div>
        ${tab.photos.length ? '' : '<div class="empty">ფოტო ჯერ არ არის. ცარიელი განყოფილება საიტზე არ ჩანს.</div>'}
        <details class="more"><summary>განყოფილების სახელი და ხატულა</summary>
          ${i18nField('tabTitle', 'სახელი', tab.title)}
          <label for="icon">ხატულა</label><select class="in" id="icon">${Object.entries(GAL_ICONS)
            .map(([k, e]) => `<option value="${k}"${k === tab.icon ? ' selected' : ''}>${e}</option>`)
            .join('')}</select>
          <label for="alt">ფოტოების აღწერა (Google-ისთვის)</label><input class="in" id="alt" value="${esc(tab.photos[0]?.alt?.ka || '')}" placeholder="მაგ. სანდომი საერთაშორისო გამოფენაზე">
          ${tab.photos.length ? '' : '<button class="btn danger" id="delTab" style="margin-top:14px">განყოფილების წაშლა</button>'}
        </details>
      </div>`
          : ''
      }
      <div class="note">💡 ფოტოს ზომას პანელი თავად შეამცირებს. ცვლილებები საიტზე „შენახვის“ შემდეგ აისახება.</div>`;
    wireTranslate();

    const syncTab = () => {
      if (!tab || !$('#tabTitle-ka')) return;
      tab.title = readI18n('tabTitle');
      tab.icon = $('#icon').value;
      const alt = $('#alt').value.trim();
      if (alt && alt !== tab.photos[0]?.alt?.ka) tab.photos.forEach((p) => (p.alt = { ka: alt, en: '', ru: '' }));
    };
    const act = (fn) => () => {
      syncTab();
      fn();
      draw();
    };
    $$('[data-tab]').forEach((b) => (b.onclick = act(() => (cur = +b.dataset.tab))));
    $('#newTab').onclick = act(() => {
      g.push({
        id: `t${Date.now().toString(36)}`,
        icon: 'camera',
        title: { ka: 'ახალი განყოფილება', en: '', ru: '' },
        photos: [],
      });
      cur = g.length - 1;
    });
    if (!tab) return;
    $('#tabUp').onclick = act(() => {
      move(g, cur, -1);
      cur = Math.max(0, cur - 1);
    });
    $('#tabDown').onclick = act(() => {
      move(g, cur, 1);
      cur = Math.min(g.length - 1, cur + 1);
    });
    $$('[data-l]').forEach((b) => (b.onclick = act(() => move(tab.photos, +b.dataset.l, -1))));
    $$('[data-r]').forEach((b) => (b.onclick = act(() => move(tab.photos, +b.dataset.r, 1))));
    $$('[data-rm]').forEach((b) => (b.onclick = act(() => tab.photos.splice(+b.dataset.rm, 1))));
    if ($('#delTab')) $('#delTab').onclick = act(() => g.splice(cur, 1) && (cur = 0));
    $('#addPh').onclick = async () => {
      const files = await pickFile('image/*', true);
      if (!files.length) return;
      syncTab();
      const alt = tab.photos[0]?.alt || { ...tab.title };
      setStatus('busy', 'ფოტოები მზადდება…');
      for (const f of files) {
        try {
          const ph = await preparePhoto(f, { mode: 'max', max: 1400 });
          const path = newFileName('assets/img/gallery/', tab.id, ph.ext);
          pending.set(path, ph);
          tab.photos.push({ src: path, alt: { ...alt } });
        } catch {
          toast(`ვერ წავიკითხე: ${f.name}`);
        }
      }
      $('#status').hidden = true;
      draw();
    };
    $('#save').onclick = async () => {
      syncTab();
      await busy($('#save'), async () => {
        for (const t of g) {
          await fillMissing(t.title);
          const alts = new Map();
          for (const p of t.photos) {
            // translate each distinct description once
            const key = p.alt?.ka || '';
            if (!alts.has(key)) alts.set(key, await fillMissing({ ...p.alt }));
            p.alt = { ...alts.get(key) };
          }
        }
        const draft = structuredClone(data[CONTENT]);
        draft.gallery = g;
        try {
          await saveContent(
            draft,
            'გალერეა განახლდა',
            g.flatMap((t) => t.photos.map((p) => p.src)),
          );
          toast('✓ შენახულია');
        } catch {
          /* told already */
        }
      });
    };
  };
  draw();
}

/* ============================================================ site texts */

export function renderTexts() {
  const c = structuredClone(data[CONTENT]);
  const draw = () => {
    main.innerHTML = `
      ${header('საიტის ტექსტები', 'სტატისტიკა, ისტორია და კონტაქტი')}
      <form id="ed" novalidate>
      <div class="card sec"><h3>სტატისტიკა (მთავარ გვერდზე)</h3>
        <div class="stats-ed">${c.stats
          .map(
            (s, i) => `<div class="stat-ed">
            ${i18nField(`sv${i}`, 'რიცხვი', s.value)}
            ${i18nField(`sl${i}`, 'წარწერა', s.label)}
          </div>`,
          )
          .join('')}</div>
      </div>
      <div class="card sec" style="margin-top:18px"><h3>ჩვენი ისტორია</h3>
        ${i18nField('lead', 'შესავალი ტექსტი', c.story.lead, { multiline: true })}
        <span class="lbl">ისტორიის ეტაპები</span>
        <div class="tl-ed">${c.story.timeline
          .map(
            (t, i) => `<div class="tl-item">
            <div class="top" style="margin:0"><input class="in yr-in" data-yr="${i}" value="${esc(t.year)}" inputmode="numeric" aria-label="წელი">
              <label class="chk"><input type="checkbox" data-star="${i}" ${t.star ? 'checked' : ''}> ⭐ გამოკვეთილი</label>
              <span class="ml row-actions"><button type="button" class="ico" data-up="${i}">↑</button><button type="button" class="ico" data-down="${i}">↓</button><button type="button" class="ico" data-rm="${i}">✕</button></span></div>
            ${i18nField(`tt${i}`, 'სათაური', t.title)}
            ${i18nField(`tx${i}`, 'ტექსტი', t.text, { multiline: true })}
          </div>`,
          )
          .join('')}</div>
        <button type="button" class="btn ghost" id="addTl">＋ ეტაპის დამატება</button>
      </div>
      <div class="card sec" style="margin-top:18px"><h3>კონტაქტი (საიტის ბოლოში)</h3>
        ${i18nField('addr', 'მისამართი', c.contact.address)}
        <div class="row">
          <div><label for="phone">ტელეფონი</label><input class="in" id="phone" value="${esc(c.contact.phone)}"></div>
          <div><label for="sales">გაყიდვები</label><input class="in" id="sales" value="${esc(c.contact.sales)}"></div>
          <div></div>
        </div>
        <div class="row">
          <div><label for="email">ელფოსტა</label><input class="in" id="email" type="email" value="${esc(c.contact.email)}"></div>
          <div><label for="exp">ექსპორტის ელფოსტა</label><input class="in" id="exp" type="email" value="${esc(c.contact.exportEmail)}"></div>
          <div></div>
        </div>
        ${i18nField('hours', 'სამუშაო საათები', c.contact.hours)}
        <div class="note">ℹ️ ჩატბოტის „კონტაქტის“ პასუხი ცალკე იცვლება — „ჩატბოტი“ განყოფილებაში.</div>
      </div>
      <div class="foot sticky-foot"><button class="btn red" type="submit" id="save">✓ შენახვა</button></div>
      </form>`;
    wireTranslate();
    const sync = () => {
      c.stats.forEach((s, i) => {
        s.value = readI18n(`sv${i}`);
        s.label = readI18n(`sl${i}`);
      });
      c.story.lead = readI18n('lead');
      c.story.timeline.forEach((t, i) => {
        t.year = $(`[data-yr="${i}"]`).value.trim();
        t.star = $(`[data-star="${i}"]`).checked;
        t.title = readI18n(`tt${i}`);
        t.text = readI18n(`tx${i}`);
      });
      Object.assign(c.contact, {
        address: readI18n('addr'),
        phone: $('#phone').value.trim(),
        sales: $('#sales').value.trim(),
        email: $('#email').value.trim(),
        exportEmail: $('#exp').value.trim(),
        hours: readI18n('hours'),
      });
    };
    const act = (fn) => () => {
      sync();
      fn();
      draw();
    };
    const tl = c.story.timeline;
    $('#addTl').onclick = act(() =>
      tl.push({ year: String(new Date().getFullYear()), title: {}, text: {}, star: false }),
    );
    $$('[data-rm]').forEach((b) => (b.onclick = act(() => tl.splice(+b.dataset.rm, 1))));
    $$('[data-up]').forEach((b) => (b.onclick = act(() => move(tl, +b.dataset.up, -1))));
    $$('[data-down]').forEach((b) => (b.onclick = act(() => move(tl, +b.dataset.down, 1))));
    $('#ed').onsubmit = async (e) => {
      e.preventDefault();
      sync();
      await busy($('#save'), async () => {
        for (const s of c.stats) {
          await fillMissing(s.value);
          await fillMissing(s.label);
        }
        await fillMissing(c.story.lead);
        for (const t of tl) {
          await fillMissing(t.title);
          await fillMissing(t.text);
        }
        await fillMissing(c.contact.address);
        await fillMissing(c.contact.hours);
        const draft = structuredClone(data[CONTENT]);
        Object.assign(draft, { stats: c.stats, story: c.story, contact: c.contact });
        try {
          await saveContent(draft, 'საიტის ტექსტები განახლდა');
          toast('✓ შენახულია');
          draw();
        } catch {
          /* told already */
        }
      });
    };
  };
  draw();
}

/* ================================================================= news */

export function renderNews() {
  const list = data[CONTENT].news || [];
  const order = list.map((n, i) => ({ n, i })).sort((a, b) => String(b.n.date).localeCompare(String(a.n.date)));
  main.innerHTML = `
    ${header('სიახლეები', 'გამოფენები, ახალი პროდუქცია, ღონისძიებები — საიტზე ჩანს ბოლო 6', '<button class="btn red ml" id="add">＋ სიახლე</button>')}
    <div class="card">${
      order.length
        ? order
            .map(
              ({ n, i }) => `<div class="hrow${n.on === false ? ' off' : ''}">
          ${n.image ? `<img class="pimg" src="${esc(imgUrl(n.image))}" alt="">` : '<span class="pimg">📰</span>'}
          <div><b>${esc(tKa(n.title))}</b><div class="when">${esc(n.date || '')}${n.on === false ? ' · დამალულია' : ''}</div></div>
          <button class="edit ml" data-edit="${i}">✎ შეცვლა</button></div>`,
            )
            .join('')
        : '<div class="empty">სიახლე ჯერ არ არის. როცა პირველს დაამატებ, საიტზე „სიახლეების“ სექცია გამოჩნდება.</div>'
    }</div>`;
  $('#add').onclick = () =>
    renderNewsEditor(-1, {
      date: new Date().toISOString().slice(0, 10),
      title: {},
      text: {},
      image: '',
      link: '',
      on: true,
    });
  $$('[data-edit]').forEach((b) => (b.onclick = () => renderNewsEditor(+b.dataset.edit)));
}

function renderNewsEditor(index, item) {
  const n = structuredClone(item || data[CONTENT].news[index]);
  const isNew = index < 0;
  main.innerHTML = `
    <div class="crumb"><button id="back">სიახლეები</button> › <b>${isNew ? 'ახალი' : 'რედაქტირება'}</b></div>
    ${header(tKa(n.title) || 'ახალი სიახლე')}
    <form class="grid2" id="ed" novalidate>
      <div class="card sec">
        <h3>ფოტო</h3>
        <div class="drop" id="drop" style="aspect-ratio:4/3">${n.image ? `<img src="${esc(imgUrl(n.image))}" alt="">` : '<div class="ph">📷<br>დააჭირე ფოტოს ასარჩევად</div>'}<span class="chg">🔄 ${n.image ? 'შეცვლა' : 'არჩევა'}</span></div>
        ${n.image ? '<button type="button" class="linkbtn" id="noImg">ფოტოს მოხსნა</button>' : ''}
      </div>
      <div class="card sec">
        <label class="sw" style="padding-top:0"><div><b>საიტზე ჩანს</b></div><input type="checkbox" class="tg red" id="on" ${n.on !== false ? 'checked' : ''}></label>
        <label for="date">თარიღი</label><input class="in" type="date" id="date" value="${esc(n.date || '')}">
        ${i18nField('title', 'სათაური', n.title)}
        ${i18nField('text', 'ტექსტი', n.text, { multiline: true })}
        <label for="link">ბმული (არასავალდებულო)</label><input class="in" id="link" value="${esc(n.link || '')}" placeholder="https://… მაგ. Facebook-ის პოსტი">
        <div class="foot">
          <button class="btn red" type="submit" id="save">✓ შენახვა</button>
          <button class="btn ghost" type="button" id="cancel">გაუქმება</button>
          ${isNew ? '' : '<button class="btn danger ml" type="button" id="del">წაშლა</button>'}
        </div>
      </div>
    </form>`;
  const back = () => nav.go('news');
  $('#back').onclick = back;
  $('#cancel').onclick = back;
  wireTranslate();
  $('#drop').onclick = async () => {
    const [f] = await pickFile('image/*');
    if (!f) return;
    try {
      const ph = await preparePhoto(f, { mode: 'max', max: 1400 });
      n.image = newFileName('assets/img/news/', '', ph.ext);
      pending.set(n.image, ph);
      $('#drop').innerHTML = `<img src="${ph.url}" alt=""><span class="chg">🔄 შეცვლა</span>`;
    } catch {
      toast('ეს ფოტო ვერ წავიკითხე. სცადე JPG ან PNG.');
    }
  };
  if ($('#noImg'))
    $('#noImg').onclick = () => {
      n.image = '';
      $('#drop').innerHTML = '<div class="ph">📷<br>დააჭირე ფოტოს ასარჩევად</div>';
    };
  if (!isNew)
    $('#del').onclick = async () => {
      if (!confirm('წავშალო ეს სიახლე?')) return;
      const draft = structuredClone(data[CONTENT]);
      draft.news.splice(index, 1);
      try {
        await saveContent(draft, `სიახლე წაიშალა: ${tKa(n.title)}`);
        back();
      } catch {
        /* told already */
      }
    };
  $('#ed').onsubmit = async (e) => {
    e.preventDefault();
    n.on = $('#on').checked;
    n.date = $('#date').value;
    n.title = readI18n('title');
    n.text = readI18n('text');
    n.link = $('#link').value.trim();
    if (!n.title.ka) {
      $('#title-ka').classList.add('bad');
      return toast('ჩაწერე სათაური.');
    }
    if (n.link && !/^https?:\/\//.test(n.link)) return toast('ბმული უნდა იწყებოდეს https://-ით.');
    await busy($('#save'), async () => {
      await fillMissing(n.title);
      await fillMissing(n.text);
      const draft = structuredClone(data[CONTENT]);
      draft.news = draft.news || [];
      if (isNew) draft.news.push(n);
      else draft.news[index] = n;
      try {
        await saveContent(draft, `სიახლე: ${n.title.ka}`, [n.image]);
        toast('✓ შენახულია');
        back();
      } catch {
        /* told already */
      }
    });
  };
}

/* ================================================================ chatbot */

const NODE_NAMES = {
  start: 'მისალმება და მთავარი მენიუ',
  products: '🍫 პროდუქცია',
  lent: '🌿 სამარხვო',
  partner: '🤝 შეკვეთა / პარტნიორობა',
  buy: '🛒 სად ვიყიდო',
  export: '🌍 ექსპორტი',
  about: '🇬🇪 ჩვენ შესახებ',
  game: '🎮 თამაში',
  contact: '📞 კონტაქტი',
};
const LANG_KEYS = ['ka', 'en', 'ru'];

export function renderChatbot() {
  const cb = data[CHATBOT];
  const keys = Object.keys(cb.ka.nodes);
  const pick = (fn) => Object.fromEntries(LANG_KEYS.map((l) => [l, fn(cb[l]) ?? '']));
  main.innerHTML = `
    ${header('ჩატბოტი', 'თედის პასუხები. თითო აბზაცი ჩატში ცალკე შეტყობინებად ჩანს.', '<button class="btn red ml" id="save">✓ შენახვა</button>')}
    <div class="card sec">
      <h3>ფანჯრის თავი</h3>
      ${i18nField(
        'ui-title',
        'სახელი',
        pick((d) => d.ui.title),
      )}
      ${i18nField(
        'ui-greeting',
        'პირველი შეტყობინება',
        pick((d) => d.ui.greeting),
      )}
    </div>
    ${keys
      .map((k) => {
        const node = cb.ka.nodes[k];
        return `<details class="card sec cb-node" style="margin-top:14px"${k === 'start' ? ' open' : ''}>
        <summary><b>${esc(NODE_NAMES[k] || k)}</b></summary>
        ${i18nField(
          `t-${k}`,
          'პასუხი',
          pick((d) => (d.nodes[k]?.text || []).join('\n\n')),
          {
            multiline: true,
            hint: 'აბზაცებს შორის დატოვე ცარიელი ხაზი',
          },
        )}
        ${(node.options || [])
          .map((o, i) =>
            i18nField(
              `o-${k}-${i}`,
              `ღილაკი ${i + 1}`,
              pick((d) => d.nodes[k]?.options?.[i]?.label),
            ),
          )
          .join('')}
      </details>`;
      })
      .join('')}
    <div class="note">ℹ️ ღილაკების დანიშნულება (სად გადადის) უცვლელი რჩება — იცვლება მხოლოდ ტექსტი.</div>`;
  wireTranslate();
  $$('.cb-node textarea').forEach((t) => (t.rows = 6));

  $('#save').onclick = async () => {
    await busy($('#save'), async () => {
      const next = structuredClone(cb);
      const ui = { title: readI18n('ui-title'), greeting: readI18n('ui-greeting') };
      for (const [f, v] of Object.entries(ui)) {
        await fillMissing(v);
        for (const l of LANG_KEYS) next[l].ui[f] = v[l];
      }
      for (const k of keys) {
        const text = await fillMissing(readI18n(`t-${k}`));
        const paras = (s) =>
          s
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);
        for (const l of LANG_KEYS) if (next[l].nodes[k]) next[l].nodes[k].text = paras(text[l]);
        for (let i = 0; i < (cb.ka.nodes[k].options || []).length; i++) {
          const label = await fillMissing(readI18n(`o-${k}-${i}`));
          for (const l of LANG_KEYS) {
            const opt = next[l].nodes[k]?.options?.[i];
            if (opt && label[l]) opt.label = label[l];
          }
        }
      }
      try {
        await saveJson(CHATBOT, next, 'ჩატბოტის პასუხები განახლდა');
        toast('✓ შენახულია');
      } catch {
        /* told already */
      }
    });
  };
}

/* ============================================================ PDF catalog */

export async function renderPdf() {
  main.innerHTML = `
    ${header('PDF კატალოგი', 'ფაილი, რომელიც „PDF კატალოგის“ ღილაკით იხსნება')}
    <div class="card steps">
      <div class="step"><span class="num">1</span><div><b>ახლანდელი კატალოგი</b><p id="cur">იტვირთება…</p><a class="btn ghost" href="../${PDF}" target="_blank" rel="noopener">👁️ გახსნა</a></div></div>
      <div class="step"><span class="num">2</span><div><b>ახალი კატალოგის ატვირთვა</b><p>აირჩიე PDF ფაილი (40 მბ-მდე). ძველი ჩანაცვლდება, ბმული იგივე დარჩება.</p><button class="btn red" id="up">⬆ PDF-ის ატვირთვა</button></div></div>
    </div>`;
  try {
    const f = await gh(`/repos/${REPO}/contents/${PDF}?ref=${BRANCH}`);
    const commits = await gh(`/repos/${REPO}/commits?sha=${BRANCH}&path=${PDF}&per_page=1`);
    const when = commits[0] ? dateKa(commits[0].commit.author.date) : '';
    $('#cur').textContent = `${(f.size / 1048576).toFixed(1)} მბ${when ? ` · განახლდა ${when}` : ''}`;
  } catch {
    $('#cur').textContent = '';
  }
  $('#up').onclick = async () => {
    const [file] = await pickFile('application/pdf,.pdf');
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return toast('აირჩიე PDF ფაილი.');
    if (file.size > 40 * 1048576) return toast('ფაილი 40 მბ-ზე დიდია. შეამცირე და სცადე ხელახლა.');
    if (!confirm(`ავტვირთო „${file.name}“ (${(file.size / 1048576).toFixed(1)} მბ) და ჩავანაცვლო ძველი კატალოგი?`))
      return;
    await busy($('#up'), async () => {
      setStatus('busy', 'იტვირთება…');
      try {
        await commit('PDF კატალოგი განახლდა', [{ path: PDF, base64: await fileBase64(file) }]);
      } catch (e) {
        setStatus('fail', 'ვერ აიტვირთა');
        return toast(e.message);
      }
      watchFileSize(PDF, file.size);
      toast('✓ კატალოგი აიტვირთა');
      renderPdf();
    });
  };
}
