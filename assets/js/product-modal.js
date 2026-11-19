/**
 * Product details dialog, opened by clicking a catalog card. Opening it adds a
 * history entry, so the phone's back button closes the dialog instead of
 * leaving the page.
 */
import { t, productName, shelfLife } from './i18n.js';
import { products, orderLabel, imageUrl } from './catalog.js';
import { $, icon, esc, setOpen } from './util.js';

let dialog, content, lastFocus;

function similarTo(p, index) {
  return products
    .map((q, i) => [q, i])
    .filter(([q, i]) => i !== index && q.category === p.category && q.image)
    .slice(0, 4);
}

function open(index) {
  const p = products[index];
  if (!p) return;
  const name = esc(productName(p));
  const similar = similarTo(p, index);

  content.innerHTML = `
    <div class="pm-img">
      ${p.image ? `<img src="${imageUrl(p)}" alt="${name}">` : `<div class="pm-noimg">${t.photoSoon}</div>`}
      <div class="badges">
        ${p.lenten ? `<span class="badge">${t.lent}</span>` : ''}
        ${p.unit === 'kg' ? `<span class="badge bulkb">${t.bulk}</span>` : ''}
      </div>
    </div>
    <div class="pm-body">
      <span class="pcat">${t.categories[p.category] || ''}</span>
      <h3>${name}</h3>
      <ul class="pm-meta">
        ${p.weight ? `<li>${icon('weight')}${p.weight} ${t.unit[p.unit]}</li>` : ''}
        ${p.shelfLife ? `<li>${icon('clock')}${shelfLife(p.shelfLife)}</li>` : ''}
        ${p.code ? `<li>${icon('tag')}${t.code}: ${p.code}</li>` : ''}
      </ul>
      ${p.price ? `<div class="pm-price">${p.price} ₾</div>` : ''}
      <button class="btn btn-red pm-order" data-order="${esc(orderLabel(p))}">${t.order}</button>
      ${
        similar.length
          ? `<div class="pm-sim"><b>${t.similar}</b><div>${similar
              .map(
                ([q, i]) =>
                  `<button data-pm="${i}" title="${esc(productName(q))}"><img src="${imageUrl(q)}" alt=""><span>${esc(productName(q))}</span></button>`,
              )
              .join('')}</div></div>`
          : ''
      }
    </div>`;

  if (!isOpen()) history.pushState({ pm: true }, '');
  setOpen(dialog, true);
  document.documentElement.classList.add('pm-lock');
  $('.pm-box', dialog).scrollTop = 0;
  $('.pm-x', dialog).focus({ preventScroll: true });
}

const isOpen = () => dialog.classList.contains('open');

/** Hide the dialog; `fromHistory` is set when the back button already removed our entry. */
function close(fromHistory = false) {
  if (!isOpen()) return;
  setOpen(dialog, false);
  document.documentElement.classList.remove('pm-lock');
  lastFocus?.focus({ preventScroll: true });
  if (!fromHistory && history.state?.pm) history.back();
}

export function initProductModal() {
  dialog = document.createElement('div');
  dialog.className = 'pm';
  dialog.id = 'pm';
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML = `<div class="pm-box" role="dialog" aria-modal="true"><button class="pm-x" aria-label="${t.close}">✕</button><div class="pm-in"></div></div>`;
  document.body.appendChild(dialog);
  content = $('.pm-in', dialog);

  const grid = $('#grid');
  const cardFrom = (e) => !e.target.closest('[data-order], .pmore') && e.target.closest('.p[data-ix]');
  grid.addEventListener('click', (e) => {
    const card = cardFrom(e);
    if (card) open(+(lastFocus = card).dataset.ix);
  });
  grid.addEventListener('keydown', (e) => {
    const card = e.key === 'Enter' && cardFrom(e);
    if (card) open(+(lastFocus = card).dataset.ix);
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.pm-x')) return close();
    const similar = e.target.closest('[data-pm]');
    if (similar) open(+similar.dataset.pm);
    if (e.target.closest('.pm-order')) close(); // the order form takes over
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  addEventListener('popstate', () => close(true));
}
