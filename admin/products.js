/** Products, prices from a file, and the change history. */
import {
  $,
  $$,
  main,
  esc,
  KA,
  CATS,
  REPO,
  BRANCH,
  gh,
  commit,
  data,
  loadJson,
  saveJson,
  jsonText,
  watchBuild,
  setStatus,
  toast,
  translate,
  preparePhoto,
  slug,
  nav,
  dateKa,
  watchStale,
} from './core.js';
import { shelfLifeIn } from '../assets/js/card.js';

const PRODUCTS = 'data/products.json';
const IMG_DIR = 'assets/img/products/';
const SHELF = ['', '90 Days', '120 Days', '180 Days', '210 Days', '6 month', '1 Year'];
const KEY_ORDER = [
  'code',
  'name',
  'category',
  'weight',
  'unit',
  'shelfLife',
  'price',
  'lenten',
  'image',
  'carousel',
  'hidden',
];

const state = {
  filter: 'all',
  query: '',
  get products() {
    return data[PRODUCTS];
  },
  set products(v) {
    data[PRODUCTS] = v;
  },
};

function normalize(p) {
  const out = {};
  for (const k of KEY_ORDER) if (p[k] !== undefined) out[k] = p[k];
  if (out.carousel !== false) delete out.carousel;
  if (!out.hidden) delete out.hidden;
  return out;
}

export const loadProducts = () => loadJson(PRODUCTS);

async function saveProducts(message, extra = []) {
  const list = state.products.map(normalize);
  await saveJson(PRODUCTS, list, message, extra);
}

const weightLabel = (p) => (p.weight ? `${p.weight} ${KA.unit[p.unit] || p.unit}` : '—');
const catLabel = (c) => CATS[c] || c;
const imgSrc = (p) => (p.image ? `../${p.image}` : '');

function imageName(p) {
  const base = slug(p.name.ka) + (p.weight ? '-' + slug(p.weight + p.unit) : '') || 'produqti';
  const used = new Set(state.products.map((x) => x.image));
  let name = `${IMG_DIR}${base}.webp`;
  for (let i = 2; used.has(name) && name !== p.image; i++) name = `${IMG_DIR}${base}-${i}.webp`;
  return name;
}

const setView = (v) => nav.go(v);

/* ============================================================ product list */

function filtered() {
  const q = state.query.toLowerCase();
  return state.products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      if (state.filter === 'lenten' && !p.lenten) return false;
      if (state.filter === 'hidden' && !p.hidden) return false;
      if (CATS[state.filter] && p.category !== state.filter) return false;
      if (!q) return true;
      return [p.name.ka, p.name.en, p.name.ru, p.code].some((s) =>
        String(s || '')
          .toLowerCase()
          .includes(q),
      );
    });
}

export function renderList() {
  $('#navCount').textContent = state.products.length;
  const hiddenCount = state.products.filter((p) => p.hidden).length;
  main.innerHTML = `
    <div class="top">
      <div><h1>პროდუქცია</h1><div class="sub">დაამატე ახალი პროდუქტი ან შეცვალე ფასი, ფოტო და აღწერა</div></div>
      <button class="btn red ml" id="addBtn">＋ ახალი პროდუქტი</button>
    </div>
    <div class="bar">
      <input class="search" id="q" type="search" placeholder="🔍 ძებნა სახელით ან კოდით…" value="${esc(state.query)}" />
      ${[['all', 'ყველა'], ...Object.entries(CATS), ['lenten', '🌿 სამარხვო'], ['hidden', `დამალული (${hiddenCount})`]]
        .map(([f, l]) => `<button class="chip${state.filter === f ? ' on' : ''}" data-f="${f}">${esc(l)}</button>`)
        .join('')}
    </div>
    <div class="card"><div class="plist" id="plist"></div></div>
    <div class="note">💡 სეზონური პროდუქტი (მაგ. გოზინაყი, პასკა) არ წაშალო — უბრალოდ გამორთე „საიტზე ჩანს“ და სეზონზე ისევ ჩართე.</div>`;
  renderRows();

  $('#addBtn').onclick = () => renderEditor(-1);
  $('#q').oninput = (e) => {
    state.query = e.target.value.trim();
    renderRows();
  };
  $$('.chip', main).forEach(
    (c) =>
      (c.onclick = () => {
        state.filter = c.dataset.f;
        $$('.chip', main).forEach((x) => x.classList.toggle('on', x === c));
        renderRows();
      }),
  );
}

function renderRows() {
  const list = filtered();
  $('#plist').innerHTML =
    `<div class="prow head"><span></span><span>პროდუქტი</span><span>წონა</span><span>ფასი</span><span>სამარხვო</span><span>საიტზე ჩანს</span><span></span></div>` +
    (list.length
      ? list
          .map(
            ({ p, i }) => `
      <div class="prow${p.hidden ? ' off' : ''}" data-i="${i}">
        <span class="c-img">${p.image ? `<img class="pimg" loading="lazy" src="${esc(imgSrc(p))}" alt="">` : '<span class="pimg">📷</span>'}</span>
        <span class="c-name"><div class="pname">${esc(p.name.ka)}${p.hidden ? '<span class="badge">დამალული</span>' : ''}</div><div class="pcat">${esc(catLabel(p.category))}${p.code ? ' · ' + esc(p.code) : ''}</div></span>
        <span class="c-weight">${esc(weightLabel(p))} <span class="price">· ${esc(p.price || '—')} ₾</span></span>
        <span class="c-price price">${p.price ? esc(p.price) + ' ₾' : '—'}</span>
        <label class="c-lenten"><input type="checkbox" class="tg" data-k="lenten" ${p.lenten ? 'checked' : ''}><span class="cell-l">🌿 სამარხვო</span></label>
        <label class="c-vis"><input type="checkbox" class="tg red" data-k="visible" ${p.hidden ? '' : 'checked'}><span class="cell-l">საიტზე ჩანს</span></label>
        <span class="c-edit"><button class="edit">✎ შეცვლა</button></span>
      </div>`,
          )
          .join('')
      : '<div class="empty">ვერაფერი მოიძებნა</div>');

  $$('.prow[data-i]').forEach((row) => {
    const i = Number(row.dataset.i);
    $('.edit', row).onclick = () => renderEditor(i);
    $$('.tg', row).forEach(
      (tg) =>
        (tg.onchange = async () => {
          const p = state.products[i];
          const before = { ...p };
          if (tg.dataset.k === 'lenten') p.lenten = tg.checked;
          else p.hidden = !tg.checked;
          $$('.tg', row).forEach((x) => (x.disabled = true));
          const what =
            tg.dataset.k === 'lenten'
              ? tg.checked
                ? 'სამარხვო'
                : 'არა სამარხვო'
              : tg.checked
                ? 'საიტზე ჩაირთო'
                : 'საიტიდან დაიმალა';
          try {
            await saveProducts(`${p.name.ka}: ${what}`);
            toast(`✓ ${p.name.ka} — ${what}`);
          } catch {
            state.products[i] = before;
          }
          renderRows();
        }),
    );
  });
}

/* ========================================================== product editor */

function renderEditor(index) {
  const isNew = index < 0;
  const p = isNew
    ? {
        code: '',
        name: { ka: '', en: '', ru: '' },
        category: 'biscuit',
        weight: '',
        unit: 'g',
        shelfLife: '180 Days',
        price: '',
        lenten: false,
        image: '',
      }
    : structuredClone(state.products[index]);
  let photo = null; // {base64, url, ext} when a new photo is chosen

  const shelfOptions = (SHELF.includes(p.shelfLife) ? SHELF : [...SHELF, p.shelfLife])
    .map(
      (v) =>
        `<option value="${esc(v)}"${v === p.shelfLife ? ' selected' : ''}>${v ? esc(shelfLifeIn(v, 'ka').replace(/^.*?:\s*/, '')) : 'არ არის მითითებული'}</option>`,
    )
    .join('');

  main.innerHTML = `
    <div class="crumb"><button id="back">პროდუქცია</button> › <b>${isNew ? 'ახალი პროდუქტი' : 'რედაქტირება'}</b></div>
    <div class="top"><h1 id="title">${esc(isNew ? 'ახალი პროდუქტი' : p.name.ka)}</h1></div>
    <form class="grid2" id="ed" novalidate>
      <div class="card sec">
        <h3>ფოტო</h3>
        <div class="drop" id="drop" tabindex="0">
          ${p.image ? `<img id="pv" src="${esc(imgSrc(p))}" alt="">` : '<div class="ph" id="ph">📷<br>ჩააგდე ფოტო აქ<br>ან დააჭირე ასარჩევად</div>'}
          <span class="chg">🔄 ${p.image ? 'შეცვლა' : 'არჩევა'}</span>
        </div>
        <input type="file" id="file" accept="image/*" hidden />
        <div class="dz-hint">ზომას და თეთრ ფონს პანელი თავად მოარგებს. საუკეთესოა პროდუქტის ფოტო თეთრ ან გამჭვირვალე ფონზე.</div>
        <div class="note">👁️ შენახვიდან 1–2 წუთში ცვლილება საიტზე სამივე ენაზე გამოჩნდება.</div>
      </div>
      <div class="card sec">
        <h3>ინფორმაცია</h3>
        <label for="nka">სახელი ქართულად</label>
        <input class="in" id="nka" value="${esc(p.name.ka)}" required />
        <span class="lbl">სახელი ინგლისურად და რუსულად</span>
        <div class="tr"><span class="flag">EN</span><input class="in" id="nen" value="${esc(p.name.en)}" /></div>
        <div class="tr"><span class="flag">RU</span><input class="in" id="nru" value="${esc(p.name.ru)}" /></div>
        <div class="tr"><button type="button" class="auto" id="trBtn">✨ ავტომატურად თარგმნა</button><small class="sub" style="margin:0">გადაამოწმე შედეგი, განსაკუთრებით ბრენდის სახელები</small></div>
        <div class="row">
          <div><label for="cat">კატეგორია</label><select class="in" id="cat">${Object.entries(CATS)
            .map(([k, v]) => `<option value="${k}"${k === p.category ? ' selected' : ''}>${esc(v)}</option>`)
            .join('')}</select></div>
          <div><label for="w">წონა</label><div class="unit"><input class="in" id="w" inputmode="decimal" value="${esc(p.weight)}" /><select class="in" id="u"><option value="g"${p.unit === 'g' ? ' selected' : ''}>გ</option><option value="kg"${p.unit === 'kg' ? ' selected' : ''}>კგ</option></select></div></div>
          <div><label for="pr">ფასი, ₾</label><input class="in" id="pr" inputmode="decimal" value="${esc(p.price)}" /></div>
        </div>
        <div class="row">
          <div><label for="sl">შენახვის ვადა</label><select class="in" id="sl">${shelfOptions}</select></div>
          <div style="grid-column: span 2"><label for="code">შტრიხკოდი / კოდი</label><input class="in" id="code" inputmode="numeric" value="${esc(p.code)}" /><div class="warn" id="dup" hidden></div></div>
        </div>
        <div style="margin-top: 12px">
          <label class="sw"><div><b>საიტზე ჩანს</b><small>გამორთე, თუ პროდუქტი დროებით არ იწარმოება ან სეზონური არ არის</small></div><input type="checkbox" class="tg red" id="vis" ${p.hidden ? '' : 'checked'}></label>
          <label class="sw"><div><b>🌿 სამარხვო</b><small>გამოჩნდება „სამარხვო“ ფილტრში და ნიშნით</small></div><input type="checkbox" class="tg" id="len" ${p.lenten ? 'checked' : ''}></label>
          <label class="sw"><div><b>მთავარი გვერდის კარუსელში</b><small>ტელეფონზე, მთავარ გვერდზე. გამორთე, თუ ფოტოზე მხოლოდ ყუთია</small></div><input type="checkbox" class="tg" id="car" ${p.carousel === false ? '' : 'checked'}></label>
        </div>
        <div class="foot">
          <button class="btn red" type="submit" id="save">✓ შენახვა და გამოქვეყნება</button>
          <button class="btn ghost" type="button" id="cancel">გაუქმება</button>
          ${isNew ? '' : '<button class="btn danger ml" type="button" id="del">წაშლა</button>'}
        </div>
      </div>
    </form>`;

  const back = () => setView('products');
  $('#back').onclick = back;
  $('#cancel').onclick = back;

  // photo
  const drop = $('#drop');
  const file = $('#file');
  const usePhoto = async (f) => {
    if (!f || !f.type.startsWith('image/')) return toast('აირჩიე ფოტოს ფაილი.');
    drop.style.opacity = 0.6;
    try {
      photo = await preparePhoto(f, { mode: 'fit' });
      drop.innerHTML = `<img id="pv" src="${photo.url}" alt=""><span class="chg">🔄 შეცვლა</span>`;
    } catch {
      toast('ეს ფოტო ვერ წავიკითხე. სცადე JPG ან PNG ფორმატი.');
    }
    drop.style.opacity = '';
  };
  drop.onclick = () => file.click();
  drop.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && file.click();
  file.onchange = () => usePhoto(file.files[0]);
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add('over');
  };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    usePhoto(e.dataTransfer.files[0]);
  };

  // title follows the Georgian name
  $('#nka').oninput = (e) => ($('#title').textContent = e.target.value || 'ახალი პროდუქტი');
  watchStale($('#nka'), [$('#nen'), $('#nru')]);

  // duplicate barcode warning
  const checkDup = () => {
    const code = $('#code').value.trim();
    const other = code && state.products.find((x, j) => j !== index && x.code === code);
    $('#dup').hidden = !other;
    if (other) $('#dup').textContent = `⚠️ ეს კოდი უკვე აქვს: ${other.name.ka}`;
  };
  $('#code').oninput = checkDup;
  checkDup();

  // translation
  $('#trBtn').onclick = async () => {
    const ka = $('#nka').value.trim();
    if (!ka) return toast('ჯერ ქართული სახელი ჩაწერე.');
    const btn = $('#trBtn');
    btn.disabled = true;
    btn.textContent = '✨ ითარგმნება…';
    try {
      const [en, ru] = await Promise.all([translate(ka, 'en'), translate(ka, 'ru')]);
      $('#nen').value = en;
      $('#nru').value = ru;
      delete $('#nen').dataset.stale;
      delete $('#nru').dataset.stale;
    } catch {
      toast('თარგმანი ახლა ვერ მოხერხდა. ჩაწერე ხელით ან სცადე მოგვიანებით.');
    }
    btn.disabled = false;
    btn.textContent = '✨ ავტომატურად თარგმნა';
  };

  // delete
  if (!isNew)
    $('#del').onclick = async () => {
      if (
        !confirm(
          `წავშალო „${p.name.ka}“ სამუდამოდ?\n\nთუ პროდუქტი მხოლოდ დროებით არ იყიდება, ჯობია „საიტზე ჩანს“ გამორთო.`,
        )
      )
        return;
      const removed = state.products.splice(index, 1)[0];
      try {
        await saveProducts(`წაიშალა: ${removed.name.ka}`);
        toast(`✓ წაიშალა: ${removed.name.ka}`);
        back();
      } catch {
        state.products.splice(index, 0, removed);
      }
    };

  // save
  $('#ed').onsubmit = async (e) => {
    e.preventDefault();
    const num = (v) => v.trim().replace(',', '.');
    const ka = $('#nka').value.trim();
    const price = num($('#pr').value);
    const weight = num($('#w').value);
    $$('.in', main).forEach((x) => x.classList.remove('bad'));
    const bad = [];
    if (!ka) bad.push('#nka');
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) bad.push('#pr');
    if (weight && !/^\d+(\.\d+)?$/.test(weight)) bad.push('#w');
    if (bad.length) {
      bad.forEach((s) => $(s).classList.add('bad'));
      $(bad[0]).focus();
      return toast('შეამოწმე წითლად მონიშნული ველი.');
    }

    let en = $('#nen').dataset.stale ? '' : $('#nen').value.trim();
    let ru = $('#nru').dataset.stale ? '' : $('#nru').value.trim();
    if (!en || !ru) {
      // fill missing translations automatically
      try {
        if (!en) en = await translate(ka, 'en');
        if (!ru) ru = await translate(ka, 'ru');
      } catch {
        /* saved without; the site falls back to Georgian */
      }
    }

    Object.assign(p, {
      name: { ka, en, ru },
      category: $('#cat').value,
      weight,
      unit: $('#u').value,
      price: price ? Number(price).toFixed(2) : '',
      shelfLife: $('#sl').value,
      code: $('#code').value.trim(),
      lenten: $('#len').checked,
      hidden: !$('#vis').checked,
      carousel: $('#car').checked ? undefined : false,
    });

    const extra = [];
    if (photo) {
      p.image = imageName(p).replace(/\.webp$/, '.' + photo.ext);
      extra.push({ path: p.image, base64: photo.base64 });
    }

    const save = $('#save');
    save.disabled = true;
    save.textContent = 'ინახება…';
    const snapshot = state.products.slice();
    if (isNew) state.products.unshift(p);
    else state.products[index] = p;
    try {
      await saveProducts(`${isNew ? 'ახალი პროდუქტი' : 'შეიცვალა'}: ${ka}`, extra);
      toast(`✓ შენახულია: ${ka}`);
      back();
    } catch {
      state.products = snapshot;
      save.disabled = false;
      save.textContent = '✓ შენახვა და გამოქვეყნება';
    }
  };
}

/* =========================================================== price import */

function parseCsv(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) (row.push(cell), (cell = ''));
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      (row.push(cell), rows.push(row), (row = []), (cell = ''));
    } else cell += ch;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows.map((r) =>
    r.map((c) =>
      c
        .replace(/^﻿/, '')
        .replace(/^="?|"$/g, '')
        .trim(),
    ),
  );
}

export function renderPrices() {
  main.innerHTML = `
    <div class="top"><div><h1>ფასები ფაილით</h1><div class="sub">ყველა ფასის ერთად განახლება Excel-ით</div></div></div>
    <div class="card steps">
      <div class="step"><span class="num">1</span><div><b>ჩამოტვირთე ფასების ფაილი</b><p>გაიხსნება Excel-ში: კოდი, სახელი და ფასი.</p><button class="btn ghost" id="dl">⬇ ფასები.csv</button></div></div>
      <div class="step"><span class="num">2</span><div><b>შეცვალე მხოლოდ „ფასი“ სვეტი</b><p>კოდი და სახელი არ შეცვალო. შეინახე იგივე ფორმატით (CSV).</p></div></div>
      <div class="step"><span class="num">3</span><div><b>ატვირთე ფაილი</b><p>პანელი გაჩვენებს, რა იცვლება. შემდეგ დააჭირე „გამოქვეყნებას“.</p><label class="btn red" style="margin:0">⬆ ფაილის ატვირთვა<input type="file" id="up" accept=".csv,text/csv" hidden></label></div></div>
    </div>
    <div id="diff"></div>`;

  $('#dl').onclick = () => {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      ['კოდი', 'სახელი', 'ფასი'].join(';'),
      ...state.products.map((p) => [`="${p.code}"`, q(p.name.ka), p.price].join(';')),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sandomi-fasebi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  $('#up').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rows = parseCsv(await f.text()).filter((r) => r.length >= 3 && r.some(Boolean));
    const changes = [];
    const unknown = [];
    for (const [code, name, rawPrice] of rows.slice(1)) {
      const price = rawPrice.replace(',', '.').replace(/[^\d.]/g, '');
      if (!price) continue;
      // match by code and name (codes can repeat), then by code, then by name
      const i = [
        state.products.findIndex((p) => p.code === code && p.name.ka === name),
        state.products.findIndex((p) => p.code === code),
        state.products.findIndex((p) => p.name.ka === name),
      ].find((x) => x >= 0);
      if (i === undefined) {
        unknown.push(name || code);
        continue;
      }
      const next = Number(price).toFixed(2);
      if (next !== state.products[i].price && !changes.some((c) => c.i === i)) changes.push({ i, next });
    }
    const box = $('#diff');
    if (!changes.length) {
      box.innerHTML = `<div class="note">ფაილში ფასები არ შეცვლილა.${unknown.length ? ` ვერ ვიპოვე: ${esc(unknown.join(', '))}` : ''}</div>`;
      return;
    }
    box.innerHTML = `
      <div class="top diff"><h1 style="font-size:20px">იცვლება ${changes.length} ფასი</h1><button class="btn red ml" id="pub">✓ გამოქვეყნება</button></div>
      <div class="card">${changes
        .map(
          ({ i, next }) =>
            `<div class="drow"><span>${esc(state.products[i].name.ka)}</span><span class="old">${esc(state.products[i].price || '—')}</span><span>→</span><b class="price">${next} ₾</b></div>`,
        )
        .join('')}</div>
      ${unknown.length ? `<div class="warn">ვერ ვიპოვე (გამოტოვებულია): ${esc(unknown.join(', '))}</div>` : ''}`;
    $('#pub').onclick = async () => {
      $('#pub').disabled = true;
      const before = changes.map(({ i }) => state.products[i].price);
      changes.forEach(({ i, next }) => (state.products[i].price = next));
      try {
        await saveProducts(`ფასები განახლდა (${changes.length})`);
        toast(`✓ განახლდა ${changes.length} ფასი`);
        setView('products');
      } catch {
        changes.forEach(({ i }, k) => (state.products[i].price = before[k]));
        $('#pub').disabled = false;
      }
    };
  };
}

/* ================================================================ history */

export async function renderHistory() {
  main.innerHTML = `
    <div class="top"><div><h1>ცვლილებების ისტორია</h1><div class="sub">ნებისმიერი შეცდომა ერთი დაჭერით გამოსწორდება</div></div></div>
    <div class="card" id="hist"><div class="loading" style="padding:24px">იტვირთება…</div></div>
    <div class="note">„დაბრუნება“ აღადგენს პროდუქციას და ტექსტებს ზუსტად ისე, როგორც იყო ამ ცვლილების შემდეგ. თავად დაბრუნებაც ისტორიაში ჩაიწერება, ამიტომ მისი გაუქმებაც შეიძლება.</div>`;
  let commits;
  try {
    commits = await gh(`/repos/${REPO}/commits?sha=${BRANCH}&path=data&per_page=30`);
  } catch (e) {
    $('#hist').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }

  $('#hist').innerHTML = commits
    .map(
      (c, k) => `
      <div class="hrow"><div><b>${esc(c.commit.message.split('\n')[0])}</b><div class="when">${dateKa(c.commit.author.date, { time: true })}</div></div>
      ${k === 0 ? '<span class="badge ml">ახლანდელი</span>' : `<button class="btn ghost" data-sha="${c.sha}">↩ დაბრუნება</button>`}</div>`,
    )
    .join('');
  $$('#hist [data-sha]').forEach(
    (b) =>
      (b.onclick = async () => {
        const c = commits.find((x) => x.sha === b.dataset.sha);
        const title = c.commit.message.split('\n')[0];
        if (!confirm(`დავაბრუნო საიტის მონაცემები ამ მომენტზე?\n\n„${title}“`)) return;
        b.disabled = true;
        try {
          const tree = await gh(`/repos/${REPO}/git/trees/${c.commit.tree.sha}?recursive=1`);
          const files = tree.tree.filter((e) => e.type === 'blob' && /^data\/[^/]+\.json$/.test(e.path));
          setStatus('busy', 'ინახება…');
          await commit(
            `დაბრუნება: „${title}“`,
            files.map((e) => ({ path: e.path, sha: e.sha })),
          );
          for (const path of Object.keys(data)) await loadJson(path);
          watchBuild(PRODUCTS, jsonText(data[PRODUCTS]));
          toast('✓ დაბრუნდა');
          renderHistory();
        } catch (e) {
          setStatus('fail', 'ვერ შეინახა');
          toast(e.message);
          b.disabled = false;
        }
      }),
  );
}
