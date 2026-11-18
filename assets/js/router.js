/**
 * Catalog view. "#catalog" (or "#catalog-wafer", "#catalog-lent", ...) shows the
 * full catalog instead of the home page; "#home" returns to where the visitor was.
 */
import { setFilter, update } from './catalog.js';
import { $, $$ } from './util.js';

let homeScroll = 0;

function route() {
  const hash = location.hash.slice(1);
  const body = document.body;
  const toCatalog = hash === 'catalog' || hash.startsWith('catalog-');
  const wasCatalog = body.classList.contains('catmode');

  if (toCatalog && !wasCatalog) homeScroll = scrollY;
  body.classList.toggle('catmode', toCatalog);
  document.documentElement.style.setProperty('--hh', `${$('header')?.offsetHeight || 64}px`);

  if (toCatalog) {
    setFilter(hash.startsWith('catalog-') ? hash.slice(8) : 'all');
    scrollTo(0, 0);
  } else {
    update();
    if (wasCatalog) {
      const target = hash && hash !== 'home' && document.getElementById(hash);
      setTimeout(() => (target ? target.scrollIntoView() : scrollTo(0, homeScroll)), 30);
    }
  }
  $$('#menu, .burger').forEach((el) => el.classList.remove('open'));
}

export function initRouter() {
  addEventListener('hashchange', route);
  route();
}
