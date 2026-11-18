/** Header menu, PDF catalog links and scroll-reveal animation. */
import { root } from './i18n.js';
import { $, $$ } from './util.js';

const PDF = 'catalog/sandomi-catalog-2026.pdf';

export const openCatalogPdf = () => window.open(root + PDF, '_blank', 'noopener');

export function initNav() {
  const menu = $('#menu');
  $('#burger').addEventListener('click', () => menu.classList.toggle('open'));
  menu.addEventListener('click', (e) => e.target.tagName === 'A' && menu.classList.remove('open'));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-pdf]')) return;
    e.preventDefault();
    openCatalogPdf();
  });

  // Reveal sections as they scroll into view.
  const items = $$('.rv');
  if (!('IntersectionObserver' in window)) return items.forEach((el) => el.classList.add('in'));
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }),
    { threshold: 0.12 },
  );
  items.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    observer.observe(el);
  });
}
