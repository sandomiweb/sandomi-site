/** Small DOM helpers shared by the modules. */

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/** Inline SVG icon from the sprite in the page (<symbol id="i-...">). */
export const icon = (name) =>
  `<svg class="ic" aria-hidden="true"><use href="${document.documentElement.dataset.root || ''}assets/img/icons.svg#i-${name}"/></svg>`;

/** Escape text for use inside HTML templates. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Short notification at the bottom of the screen. */
export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** Generic open/close for dialogs that use the "open" class + aria-hidden. */
export function setOpen(el, open) {
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
}

/** Local storage that never throws (private mode, blocked storage). */
export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
