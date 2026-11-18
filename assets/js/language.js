/**
 * Language choice. Each language is its own page (/, /en/, /ru/); the options in
 * the dialog are plain links. On the first visit the dialog opens with a
 * suggestion based on the browser language, and the choice is remembered.
 */
import { lang } from './i18n.js';
import { $, $$, setOpen, storage } from './util.js';

const KEY = 'sandomi_lang';
const LEGACY = { ge: 'ka', intl: 'en', cis: 'ru' }; // values stored by the first version of the site

function browserLanguage() {
  const l = (navigator.language || 'ka').toLowerCase();
  if (l.startsWith('ka')) return 'ka';
  if (/^(ru|uk|be|kk|hy|az|uz|ky|tg)/.test(l)) return 'ru';
  return 'en';
}

export function initLanguage() {
  const modal = $('#regModal');
  const saved = storage.get(KEY) || LEGACY[storage.get('sandomi_region')];

  const open = () => {
    const suggested = saved || browserLanguage();
    $$('.reg-o', modal).forEach((o) => o.classList.toggle('sug', o.dataset.lang === suggested));
    setOpen(modal, true);
  };

  $$('.reg-o', modal).forEach((option) =>
    option.addEventListener('click', (e) => {
      storage.set(KEY, option.dataset.lang);
      if (option.dataset.lang === lang) {
        e.preventDefault(); // already on this language
        setOpen(modal, false);
      } else {
        option.href += location.hash; // keep the visitor's place on the page
      }
    }),
  );
  $('#regBtn').addEventListener('click', open);

  if (!saved) setTimeout(open, 700);
}
