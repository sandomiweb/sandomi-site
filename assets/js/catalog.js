/**
 * Product catalog: renders cards from data/products.json, handles category
 * chips, search and "show more". On the home page phones get an endless
 * swipe carousel of every product in its printed retail pack (not sold by
 * weight, not marked `carousel: false`), in a new random order on each visit; wider screens get one random
 * product per category, packaged where possible. The full catalog
 * opens at #catalog (see router.js).
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
/** Card indices in the order the home carousel shows them. */
let carousel = [];

const grid = $('#grid');
const moreBtn = () => $('#pmore');
const phone = matchMedia('(max-width: 700px)');

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

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

  if (!isCatalog && phone.matches) {
    const inCarousel = new Set(carousel);
    cards.forEach((c, i) => c.classList.toggle('hide', !inCarousel.has(i)));
    more.style.display = 'none';
    return;
  }

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
  const res = await fetch(root + 'data/products.json', { cache: 'no-cache' });
  products = await res.json();
  products.sort((a, b) => Boolean(b.image) - Boolean(a.image)); // products with photos first

  const withPhoto = products.map((p, i) => (p.image ? i : -1)).filter((i) => i >= 0);
  // `carousel: false` in products.json keeps plain shipping-box photos out.
  const packaged = withPhoto.filter((i) => products[i].unit !== 'kg' && products[i].carousel !== false);
  const pick = (list, cat) => shuffle(list.filter((i) => products[i].category === cat))[0];
  featured = new Set(
    FEATURED_ORDER.map((cat) => pick(packaged, cat) ?? pick(withPhoto, cat)).filter((i) => i !== undefined),
  );
  carousel = shuffle(packaged);

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
  initCarouselLoop();
}

/**
 * Lazy loading only starts an image once it is scrolled into view, which in a
 * swipe carousel shows empty cards for a moment. When the products section
 * gets near, load all carousel photos (about 1 MB in total) in advance.
 */
function preloadCarouselImages() {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting) || !phone.matches) return;
      observer.disconnect();
      const cards = $$('.p', grid);
      carousel.forEach((ix) => {
        const img = $('img', cards[ix]);
        if (img) img.loading = 'eager';
      });
    },
    { rootMargin: '800px 0px' },
  );
  observer.observe(grid);
}

/** Position of each card in the carousel, applied through CSS `order`. */
function applyCarouselOrder() {
  const cards = $$('.p', grid);
  carousel.forEach((ix, pos) => cards[ix].style.setProperty('--o', pos));
}

/**
 * Endless home carousel on phones. When swiping stops near either end, cards
 * from the far end are moved over and the scroll position is shifted by the
 * same width, so the strip never runs out and nothing visibly jumps.
 */
function initCarouselLoop() {
  applyCarouselOrder();
  preloadCarouselImages();
  const step = () => {
    const [a, b] = carousel.slice(0, 2).map((ix) => grid.children[ix]);
    return b.offsetLeft - a.offsetLeft;
  };
  const active = () => phone.matches && !document.body.classList.contains('catmode');
  const MARGIN = 4;

  // Start in the middle so there are cards in both directions; also after
  // returning from the full catalog, which resets the scroll position.
  const centre = () => {
    if (active() && grid.scrollLeft < step()) grid.scrollLeft = Math.floor(carousel.length / 2) * step();
  };
  centre();
  phone.addEventListener('change', centre);
  addEventListener('hashchange', () => requestAnimationFrame(centre));

  let idle;
  grid.addEventListener(
    'scroll',
    () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        if (!active()) return;
        const w = step();
        const first = Math.round(grid.scrollLeft / w);
        const visible = Math.ceil(grid.clientWidth / w);
        let moved = 0;
        if (first < MARGIN) moved = -Math.floor(carousel.length / 2);
        else if (first + visible > carousel.length - MARGIN) moved = Math.floor(carousel.length / 2);
        if (!moved) return;
        carousel = [...carousel.slice(moved), ...carousel.slice(0, moved)]; // rotate
        // Snapping is paused so the browser doesn't re-snap on its own while
        // the cards are reordered; we shift the scroll position ourselves.
        grid.style.scrollSnapType = 'none';
        applyCarouselOrder();
        grid.scrollLeft -= moved * w;
        requestAnimationFrame(() => (grid.style.scrollSnapType = ''));
      }, 150);
    },
    { passive: true },
  );
}
