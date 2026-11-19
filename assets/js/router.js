/**
 * Catalog view. "#catalog" (or "#catalog-wafer", "#catalog-lent", ...) shows the
 * full catalog instead of the home page; "#home" returns to where the visitor was.
 * Topic pages (/vafli/, /tklapi/, ...) open in the catalog view with their own
 * selection when the address has no "#".
 */
import { PAGE_FILTER, setFilter, update } from './catalog.js';
import { $, $$ } from './util.js';

let homeScroll = 0;

function route() {
  const hash = location.hash.slice(1);
  const body = document.body;
  const { filter: pageFilter, codes } = document.documentElement.dataset;
  const topic = pageFilter || (codes ? PAGE_FILTER : '');
  const toCatalog = hash === 'catalog' || hash.startsWith('catalog-') || (!hash && Boolean(topic));
  const wasCatalog = body.classList.contains('catmode');

  if (toCatalog && !wasCatalog) homeScroll = scrollY;
  body.classList.toggle('catmode', toCatalog);
  document.documentElement.style.setProperty('--hh', `${$('header')?.offsetHeight || 64}px`);

  if (toCatalog) {
    setFilter(hash.startsWith('catalog-') ? hash.slice(8) : hash === 'catalog' ? 'all' : topic);
    scrollTo(0, 0);
  } else {
    update();
    if (wasCatalog) {
      const target = hash && hash !== 'home' && document.getElementById(hash);
      const restore = () => (target ? target.scrollIntoView() : scrollTo(0, homeScroll));
      // Once the home sections are shown again, and once more after late layout
      // changes (images, the browser's own scroll restoration) have settled.
      setTimeout(restore, 30);
      setTimeout(restore, 250);
    }
  }
  $$('#menu, .burger').forEach((el) => el.classList.remove('open'));
}

export function initRouter() {
  addEventListener('hashchange', route);

  // Category links point to their topic page (/vafli/, ...) so search engines can
  // follow them; on this page they open the same selection without reloading.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-filter]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    location.hash = `catalog-${link.dataset.filter}`;
  });

  route();
}
