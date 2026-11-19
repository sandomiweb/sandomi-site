/**
 * Renders the parts of the page that the admin panel edits (data/content.json):
 * seasonal banners, stats, history, videos, photo gallery, news and contact.
 *
 * src/index.html marks each place with <template data-content="name">; the
 * build replaces it with markup in the page's language (missing English or
 * Russian falls back to Georgian, which the dictionary may still translate).
 */
import { esc } from '../assets/js/card.js';

const ICON = (name) => `<svg class="ic" aria-hidden="true"><use href="assets/img/icons.svg#i-${name}" /></svg>`;

/** Seasonal banner presets; "custom" uses the banner's own two colors. */
export const SEASON_THEMES = {
  winter: { icon: 'snow' },
  easter: { icon: 'star' },
  lent: { icon: 'leaf' },
  love: { icon: 'heart' },
  gold: { icon: 'star' },
  custom: { icon: 'star' },
};

/** "12-01" ≤ today ≤ "01-15" (ranges may cross the new year); no dates = always. */
export function seasonActive(b, today = new Date()) {
  if (!b.on) return false;
  if (!b.from || !b.to) return true;
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return b.from <= b.to ? md >= b.from && md <= b.to : md >= b.from || md <= b.to;
}

/** "032 283 88 88" → "tel:+995322838888" */
export function telHref(phone) {
  let d = String(phone).replace(/\D/g, '');
  if (d.startsWith('995')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return `tel:+995${d}`;
}

export const youtubeId = (url) => (String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1] || '';

function seasonCard(b, lang, t, visible) {
  const theme = SEASON_THEMES[b.theme] ? b.theme : 'winter';
  const custom =
    theme === 'custom'
      ? ` style="--s1: ${esc(b.colors?.[0] || '#5c0718')}; --s2: ${esc(b.colors?.[1] || '#c8102e')}"`
      : '';
  const cls = ['season-card', 'rv', theme !== 'winter' && `t-${theme}`, b.dark && 'dark'].filter(Boolean).join(' ');
  const eyebrowCls = theme === 'winter' ? 'eyebrow eyebrow-ice' : 'eyebrow';
  const imgs = (b.images || []).filter(Boolean).slice(0, 3);
  return `<div class="${cls}"${custom} data-from="${esc(b.from || '')}" data-to="${esc(b.to || '')}"${visible ? '' : ' hidden'}>
            <div class="season-txt">
              <div class="${eyebrowCls}">${ICON(SEASON_THEMES[theme].icon)}${esc(t(b.eyebrow))}</div>
              <h2>${esc(t(b.title))}</h2>
              <p>${esc(t(b.text))}</p>
              ${t(b.button) ? `<a href="#catalog-${esc(b.filter || 'all')}" class="btn btn-gold" data-filter="${esc(b.filter || 'all')}">${esc(t(b.button))}</a>` : ''}
            </div>
            <div class="season-art">
              ${imgs.map((src, i) => `<img class="sp sp${i + 1}" src="${esc(src)}" alt="" />`).join('')}
              ${b.bear !== false ? '<img class="season-bear" src="assets/img/teddy.webp" alt="სანდომის დათუნია" />' : ''}
            </div>
            ${b.snow !== false && theme === 'winter' ? '<div class="snow" aria-hidden="true"></div>' : ''}
          </div>`;
}

const RENDER = {
  season(c, lang, t, today) {
    const banners = (c.season || []).filter((b) => b.on);
    const active = banners.find((b) => seasonActive(b, today));
    return banners.map((b) => seasonCard(b, lang, t, b === active)).join('\n');
  },

  stats: (c, lang, t) =>
    (c.stats || [])
      .map((s) => `<div class="stat rv"><b>${esc(t(s.value))}</b><span>${esc(t(s.label))}</span></div>`)
      .join(''),

  timeline: (c, lang, t) =>
    (c.story?.timeline || [])
      .map(
        (i) => `<li>
                <span class="yr">${esc(i.year)}</span>
                <h4>${i.star ? ICON('star') : ''}${esc(t(i.title))}</h4>
                <p>${esc(t(i.text))}</p>
              </li>`,
      )
      .join(''),

  'video-main': (c, lang, t) =>
    c.videos?.main?.url
      ? `<a class="video rv" href="${esc(c.videos.main.url)}" target="_blank" rel="noopener"
              ><div class="play">▶</div>
              <b>${esc(t(c.videos.main.title))}</b><small>უყურე YouTube-ზე ↗</small></a
            >`
      : '',

  videos: (c, lang, t) =>
    (c.videos?.list || [])
      .filter((v) => v.url)
      .map((v) => {
        const cover = v.cover || `https://i.ytimg.com/vi/${youtubeId(v.url)}/hqdefault.jpg`;
        return `<a class="vc" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="vp" style="background-image: url(${esc(cover)})"><span class="pl">▶</span></span><b class="vt">${esc(t(v.title) || 'სანდომი')}</b></a>`;
      })
      .join(''),

  'gallery-tabs': (c, lang, t) =>
    galleries(c)
      .map(
        (g, i) =>
          `<button class="gt${i === 0 ? ' on' : ''}" data-g="g-${esc(g.id)}">${ICON(g.icon || 'camera')}${esc(t(g.title))}</button>`,
      )
      .join(''),

  'gallery-grids': (c, lang, t) =>
    galleries(c)
      .map(
        (g, i) => `<div class="ggrid" id="g-${esc(g.id)}"${i === 0 ? '' : ' hidden'}>
            ${g.photos.map((p) => `<figure class="pol"><img src="${esc(p.src)}" alt="${esc(t(p.alt))}" loading="lazy" /></figure>`).join('\n')}
          </div>`,
      )
      .join('\n'),

  news(c, lang, t) {
    const items = (c.news || [])
      .filter((n) => n.on !== false && t(n.title))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 6);
    if (!items.length) return '';
    const fmt = new Intl.DateTimeFormat({ ka: 'ka-GE', en: 'en-GB', ru: 'ru-RU' }[lang], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const date = (d) => {
      const x = new Date(`${d}T12:00:00Z`);
      return isNaN(x) ? '' : fmt.format(x);
    };
    return `<section class="news" id="news">
        <div class="wrap">
          <div class="rv center">
            <div class="eyebrow">სიახლეები</div>
            <h2>რა ხდება სანდომში</h2>
          </div>
          <div class="news-grid">
            ${items
              .map(
                (n) => `<article class="news-card rv">
              ${n.image ? `<img src="${esc(n.image)}" alt="${esc(t(n.title))}" loading="lazy" />` : ''}
              <div class="news-body">
                ${n.date ? `<time datetime="${esc(n.date)}">${esc(date(n.date))}</time>` : ''}
                <h3>${esc(t(n.title))}</h3>
                ${t(n.text) ? `<p>${esc(t(n.text))}</p>` : ''}
                ${n.link ? `<a class="news-more" href="${esc(n.link)}" target="_blank" rel="noopener">ვრცლად →</a>` : ''}
              </div>
            </article>`,
              )
              .join('\n')}
          </div>
        </div>
      </section>`;
  },

  contact(c, lang, t) {
    const k = c.contact || {};
    return [
      k.address && `<li>${ICON('pin')}${esc(t(k.address))}</li>`,
      k.phone && `<li>${ICON('phone')}<a href="${telHref(k.phone)}">${esc(k.phone)}</a></li>`,
      k.sales && `<li>${ICON('cart')}გაყიდვები: <a href="${telHref(k.sales)}">${esc(k.sales)}</a></li>`,
      k.email && `<li>${ICON('mail')}<a href="mailto:${esc(k.email)}">${esc(k.email)}</a></li>`,
      k.exportEmail &&
        `<li>${ICON('globe')}Export: <a href="mailto:${esc(k.exportEmail)}">${esc(k.exportEmail)}</a></li>`,
      t(k.hours) && `<li>${ICON('clock')}${esc(t(k.hours))}</li>`,
    ]
      .filter(Boolean)
      .join('\n');
  },
};

const galleries = (c) => (c.gallery || []).filter((g) => g.photos?.length);

/** Text fields: <p data-text="story.lead"> gets that value. */
function getPath(obj, p) {
  return p.split('.').reduce((o, k) => o?.[k], obj);
}

export function renderContent(document, content, lang, today = new Date()) {
  const t = (v) => (v == null ? '' : typeof v === 'string' ? v : v[lang] || v.ka || '');
  for (const tpl of [...document.querySelectorAll('template[data-content]')]) {
    const fn = RENDER[tpl.dataset.content];
    if (!fn) throw new Error(`Unknown content block: ${tpl.dataset.content}`);
    const html = fn(content, lang, t, today);
    const box = document.createElement('div');
    box.innerHTML = html;
    tpl.replaceWith(...box.childNodes);
  }
  for (const el of document.querySelectorAll('[data-text]')) {
    el.textContent = t(getPath(content, el.dataset.text));
    el.removeAttribute('data-text');
  }
  // No banner switched on at all: drop the section.
  const season = document.getElementById('season');
  if (season && !season.querySelector('.season-card')) season.remove();
  else if (season && !season.querySelector('.season-card:not([hidden])')) season.hidden = true;
}
