/**
 * Product catalog: renders cards from data/products.json, handles category
 * chips, search and "show more". On the home page only a few featured
 * products are shown; the full catalog opens at #catalog (see router.js).
 */
import { t, root, productName, shelfLife } from './i18n.js';
import { $, $$, icon, esc } from './util.js';

const PAGE_SIZE = 12;
const FEATURED_ORDER = ['wafer', 'choco', 'trad', 'nuts', 'biscuit', 'jam', 'snack', 'lukum'];

/** Placeholder colours and emoji for products without a photo. */
const PLACEHOLDER = {
  wafer: ['#f3e3c4', '#e6c99a', '🧇'],
  choco: ['#e9c3a5', '#b97a52', '🍫'],
  biscuit: ['#f6e6c9', '#e5c08a', '🍪'],
  jam: ['#f8d2cf', '#e9918b', '🍓'],
  trad: ['#f5ddc0', '#d99a5a', '🍎'],
  lukum: ['#f6d9e6', '#e3a1bf', '🍬'],
  snack: ['#dbe6f6', '#9db8e3', '🥨'],
  nuts: ['#c9d9f3', '#7fa2de', '🥜'],
};

const state = { filter: 'all', query: '', limit: PAGE_SIZE };
export let products = [];
let featured = new Set();

const grid = $('#grid');
const moreBtn = () => $('#pmore');

/** "Wafer 216 g" — used to pre-fill the order form. */
export const orderLabel = (p) => `${productName(p)}${p.weight ? ` ${p.weight} ${t.unit[p.unit]}` : ''}`;
export const imageUrl = (p) => root + p.image;

function card(p, index) {
  const name = productName(p);
  const bulk = p.unit === 'kg';
  const tags = [p.lenten && 'lent', bulk && 'bulk', p.category].filter(Boolean).join(' ');
  const search = `${p.name.ka} ${p.name.en} ${p.name.ru} ${p.code}`.toLowerCase();
  const [c1, c2, emoji] = PLACEHOLDER[p.category] || PLACEHOLDER.biscuit;

  const image = p.image
    ? `<img src="${imageUrl(p)}" alt="${esc(name)}" loading="lazy">`
    : `<div class="ph-p"><span>${emoji}</span><small>${t.photoSoon}</small></div>`;

  return `
    <article class="p in" data-ix="${index}" tabindex="0" data-cat="${tags}" data-n="${esc(search)}">
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
          ${p.shelfLife ? `<span>${icon('clock')}${shelfLife(p.shelfLife)}</span>` : ''}
          ${p.code ? `<span class="code">${t.code}: ${p.code}</span>` : ''}
        </div>
        <div class="row">
          ${p.price ? `<span class="price">${p.price} ₾</span>` : '<span></span>'}
          <button class="add" data-order="${esc(orderLabel(p))}">${t.order}</button>
        </div>
      </div>
    </article>`;
}

function render() {
  grid.innerHTML = products.map(card).join('') + '<button class="btn btn-red pmore" id="pmore"></button>';
  moreBtn().addEventListener('click', () => {
    state.limit += PAGE_SIZE;
    update();
  });
  update();
}

/** Show/hide cards for the current view (home teaser or full catalog). */
export function update() {
  const cards = $$('.p', grid);
  const isCatalog = document.body.classList.contains('catmode');
  const more = moreBtn();

  if (!isCatalog) {
    const limit = innerWidth > 700 && innerWidth <= 1000 ? 6 : 8; // 3+3 on tablets
    let shown = 0;
    cards.forEach((c, i) => {
      const visible = featured.has(i) && ++shown <= limit;
      c.classList.toggle('hide', !visible);
    });
    more.style.display = 'none';
    return;
  }

  let matches = 0;
  cards.forEach((c) => {
    const ok =
      (state.filter === 'all' || c.dataset.cat.split(' ').includes(state.filter)) &&
      (!state.query || c.dataset.n.includes(state.query));
    if (ok) matches++;
    c.classList.toggle('hide', !(ok && matches <= state.limit));
  });

  const rest = matches - Math.min(matches, state.limit);
  more.style.display = rest > 0 ? '' : 'none';
  more.textContent = `${t.showMore} (${rest})`;
  $('#pcount').textContent = `${matches} ${t.products}`;
}

/** Select a category chip ("all", "wafer", "lent", ...). */
export function setFilter(filter) {
  const chip = $(`.chip[data-f="${filter}"]`) || $('.chip[data-f="all"]');
  $$('.chip').forEach((c) => c.classList.toggle('on', c === chip));
  state.filter = chip.dataset.f;
  state.limit = PAGE_SIZE;
  update();
}

export async function initCatalog() {
  const res = await fetch(root + 'data/products.json');
  products = await res.json();
  products.sort((a, b) => Boolean(b.image) - Boolean(a.image)); // products with photos first

  featured = new Set(
    FEATURED_ORDER.map((cat) => products.findIndex((p) => p.category === cat && p.image)).filter((i) => i >= 0),
  );

  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip && chip.dataset.f) setFilter(chip.dataset.f);
  });
  $('#pq').addEventListener('input', (e) => {
    state.query = e.target.value.trim().toLowerCase();
    state.limit = PAGE_SIZE;
    update();
  });

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 200);
  });

  render();
}
