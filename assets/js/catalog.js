/**
 * Product catalog: renders cards from data/products.json, handles category
 * chips, search and "show more". On the home page phones get a swipe carousel
 * of every product in its printed retail pack (not sold by weight, not marked
 * `carousel: false`) in a new random order on each visit; wider screens get
 * one random product per category, packaged where possible. The full catalog
 * opens at #catalog (see router.js).
 */
import { t, root, lang } from './i18n.js';
import { $, $$ } from './util.js';
import { cardHtml, orderLabelIn, sortProducts } from './card.js';

export const PAGE_SIZE = 12;
const FEATURED_ORDER = ['wafer', 'choco', 'trad', 'nuts', 'biscuit', 'jam', 'snack', 'lukum'];

const state = { filter: 'all', query: '', limit: PAGE_SIZE };
export let products = [];
let featured = new Set();
/** Card indices in the order the home carousel shows them (random per visit). */
let carousel = [];

/**
 * Topic pages (/vafli/, /tklapi/, ... built by tools/build.mjs) open the catalog
 * with a category (data-filter) or with a fixed list of product codes (data-codes).
 */
export const PAGE_FILTER = 'page';
const pageCodes = new Set((document.documentElement.dataset.codes || '').split(',').filter(Boolean));

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
export const orderLabel = (p) => orderLabelIn(p, lang);
export const imageUrl = (p) => root + p.image;

function render() {
  grid.innerHTML =
    products.map((p, i) => cardHtml(p, i, { lang, root })).join('') +
    '<button class="btn btn-red pmore" id="pmore"></button>';
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
      (state.filter === 'all' ||
        (state.filter === PAGE_FILTER
          ? pageCodes.has(c.dataset.code)
          : c.dataset.cat.split(' ').includes(state.filter))) &&
      (!state.query || c.dataset.n.includes(state.query));
    if (ok) matches++;
    c.classList.toggle('hide', !(ok && matches <= state.limit));
  });

  const rest = matches - Math.min(matches, state.limit);
  more.style.display = rest > 0 ? '' : 'none';
  more.textContent = `${t.showMore} (${rest})`;
  $('#pcount').textContent = `${matches} ${t.products}`;
}

/**
 * Select a category chip ("all", "wafer", "lent", ...). PAGE_FILTER selects the
 * products listed for a topic page such as /tklapi/ (no chip is highlighted).
 */
export function setFilter(filter) {
  const page = filter === PAGE_FILTER && pageCodes.size > 0;
  const chip = page ? null : $(`.chip[data-f="${filter}"]`) || $('.chip[data-f="all"]');
  $$('.chip').forEach((c) => c.classList.toggle('on', c === chip));
  state.filter = page ? PAGE_FILTER : chip.dataset.f;
  state.limit = PAGE_SIZE;
  update();
}

export async function initCatalog() {
  const res = await fetch(root + 'data/products.json', { cache: 'no-cache' });
  products = await res.json();
  sortProducts(products); // products with photos first

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
  applyCarouselOrder();
  preloadCarouselImages();
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
