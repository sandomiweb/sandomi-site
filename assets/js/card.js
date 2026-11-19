/**
 * Catalog card template. Plain functions with no browser dependencies: the page
 * script (catalog.js) and the build (tools/build.mjs, which writes the cards
 * into the HTML for search engines and AI crawlers) use the same markup.
 */
import { STRINGS } from './strings.js';

/** Placeholder colours and emoji for products without a photo. */
export const PLACEHOLDER = {
  wafer: ['#f3e3c4', '#e6c99a', '🧇'],
  choco: ['#e9c3a5', '#b97a52', '🍫'],
  biscuit: ['#f6e6c9', '#e5c08a', '🍪'],
  jam: ['#f8d2cf', '#e9918b', '🍓'],
  trad: ['#f5ddc0', '#d99a5a', '🍎'],
  lukum: ['#f6d9e6', '#e3a1bf', '🍬'],
  snack: ['#dbe6f6', '#9db8e3', '🥨'],
  nuts: ['#c9d9f3', '#7fa2de', '🥜'],
};

/** Escape text for use inside HTML templates. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Inline SVG icon from the sprite (<symbol id="i-...">). */
export const iconHtml = (name, root = '') =>
  `<svg class="ic" aria-hidden="true"><use href="${root}assets/img/icons.svg#i-${name}"/></svg>`;

/** Catalog order: products with photos first (stable, so the same in the browser and the build). */
export const sortProducts = (list) => list.sort((a, b) => Boolean(b.image) - Boolean(a.image));

/** Filter tags of a card: "lent", "bulk" and the category. */
export const cardTags = (p) => [p.lenten && 'lent', p.unit === 'kg' && 'bulk', p.category].filter(Boolean);

export const productNameIn = (p, lang) => (lang === 'en' ? p.name.en : lang === 'ru' ? p.name.ru : p.name.ka);

/** "Shelf life: 210 days" from catalog values such as "210 Days" / "1 Year" / "6 month". */
export function shelfLifeIn(value, lang) {
  const t = STRINGS[lang];
  const m = value && value.match(/(\d+)\s*(Days|Year|month)/);
  if (!m) return '';
  const unit = { Days: 'days', Year: 'year', month: 'month' }[m[2]];
  return `${t.shelf.label}: ${m[1]} ${t.shelf[unit]}`;
}

/** "Wafer 216 g" — used to pre-fill the order form. */
export const orderLabelIn = (p, lang) =>
  `${productNameIn(p, lang)}${p.weight ? ` ${p.weight} ${STRINGS[lang].unit[p.unit]}` : ''}`;

/**
 * HTML of one catalog card.
 * @param {object} p product from data/products.json
 * @param {number} index position in the sorted catalog (data-ix)
 * @param {{lang: string, root: string, hidden?: boolean}} opts
 */
export function cardHtml(p, index, { lang, root, hidden = false }) {
  const t = STRINGS[lang];
  const name = productNameIn(p, lang);
  const bulk = p.unit === 'kg';
  const tags = cardTags(p).join(' ');
  const search = `${p.name.ka} ${p.name.en} ${p.name.ru} ${p.code}`.toLowerCase();
  const [c1, c2, emoji] = PLACEHOLDER[p.category] || PLACEHOLDER.biscuit;
  const icon = (n) => iconHtml(n, root);

  const image = p.image
    ? `<img src="${root + p.image}" alt="${esc(name)}" loading="lazy">`
    : `<div class="ph-p"><span>${emoji}</span><small>${t.photoSoon}</small></div>`;

  return `
    <article class="p in${hidden ? ' hide' : ''}" data-ix="${index}" data-code="${esc(p.code || '')}" tabindex="0" data-cat="${tags}" data-n="${esc(search)}">
      <div class="img ${p.image ? 'pimg' : 'noimg'}" style="--g1:${c1};--g2:${c2}">
        ${image}
        <div class="badges">
          ${p.lenten ? `<span class="badge">${t.lent}</span>` : ''}
          ${bulk ? `<span class="badge bulkb">${t.bulk}</span>` : ''}
        </div>
      </div>
      <div class="body">
        <span class="pcat">${t.categories[p.category] || ''}</span>
        <h3>${esc(name)}</h3>
        <div class="meta">
          ${p.weight ? `<span>${icon('weight')}${p.weight} ${t.unit[p.unit]}</span>` : ''}
          ${p.shelfLife ? `<span>${icon('clock')}${shelfLifeIn(p.shelfLife, lang)}</span>` : ''}
          ${p.code ? `<span class="code">${t.code}: ${p.code}</span>` : ''}
        </div>
        <div class="row">
          ${p.price ? `<span class="price">${p.price} ₾</span>` : '<span></span>'}
          <button class="add" data-order="${esc(orderLabelIn(p, lang))}">${t.order}</button>
        </div>
      </div>
    </article>`;
}
