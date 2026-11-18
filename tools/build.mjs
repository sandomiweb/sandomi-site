/**
 * Builds the language pages from src/index.html:
 *   index.html (ქართული) · en/index.html · ru/index.html · sitemap.xml · robots.txt
 *
 * Usage: npm run build
 *
 * Translation: every text node and the alt / placeholder / aria-label / title
 * attributes whose Georgian text is found in data/i18n.json are replaced.
 * Strings created by JavaScript are translated in assets/js/i18n.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');

const LANGS = {
  ka: { dir: '', code: 'ქა', region: 'ge', locale: 'ka_GE' },
  en: { dir: 'en/', code: 'EN', region: 'intl', locale: 'en_US' },
  ru: { dir: 'ru/', code: 'RU', region: 'cis', locale: 'ru_RU' },
};
const ATTRS = ['alt', 'placeholder', 'aria-label', 'title'];
const GEORGIAN = /[Ⴀ-ჿ]/;
// Text in these elements is language-neutral or set by JavaScript.
const SKIP = 'script, style, #regModal, #cb, #cbTip';
const normalize = (s) => s.trim().replace(/\s+/g, ' ');
const missing = new Map();

function translate(text, lang) {
  if (lang === 'ka' || !GEORGIAN.test(text)) return text;
  const key = normalize(text);
  const hit = dict[key]?.[lang];
  if (!hit) {
    missing.set(key, (missing.get(key) || new Set()).add(lang));
    return text;
  }
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  return lead + hit + trail;
}

function translateDocument(document, lang) {
  const walker = document.createTreeWalker(document.body, 4 /* text */);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const n of nodes) if (!n.parentElement?.closest(SKIP)) n.nodeValue = translate(n.nodeValue, lang);

  for (const el of document.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) {
    for (const a of ATTRS) if (el.hasAttribute(a)) el.setAttribute(a, translate(el.getAttribute(a), lang));
  }
  document.title = translate(document.title, lang);
  for (const meta of document.querySelectorAll('meta[name="description"], meta[property^="og:"]')) {
    meta.setAttribute('content', translate(meta.getAttribute('content'), lang));
  }
}

/** Prefix relative URLs with "../" on the /en/ and /ru/ pages. */
function rebase(document, prefix) {
  const isRelative = (u) => u && !/^(#|[a-z]+:|\/\/|\/)/i.test(u);
  for (const [sel, attr] of [
    ['[src]', 'src'],
    ['link[href], a[href], use[href]', 'href'],
  ]) {
    for (const el of document.querySelectorAll(sel)) {
      const value = el.getAttribute(attr);
      if (isRelative(value)) el.setAttribute(attr, value === './' ? prefix || './' : prefix + value);
    }
  }
  for (const el of document.querySelectorAll('[style*="url("]')) {
    el.setAttribute('style', el.getAttribute('style').replace(/url\((?!["']?(?:[a-z]+:|\/))/g, `url(${prefix}`));
  }
}

function addHeadTags(document, lang) {
  const head = document.head;
  const url = (l) => config.baseUrl + LANGS[l].dir;
  const tag = (name, attrs) => {
    const el = document.createElement(name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    head.querySelector('meta[property="og:type"]').before(el);
  };
  tag('meta', { name: 'robots', content: config.indexable ? 'index, follow' : 'noindex, nofollow' });
  tag('link', { rel: 'canonical', href: url(lang) });
  for (const l of Object.keys(LANGS)) tag('link', { rel: 'alternate', hreflang: l, href: url(l) });
  tag('link', { rel: 'alternate', hreflang: 'x-default', href: url('ka') });
  tag('meta', { property: 'og:url', content: url(lang) });
  tag('meta', { property: 'og:locale', content: LANGS[lang].locale });
  tag('meta', { property: 'og:image', content: config.baseUrl + 'assets/img/og.jpg' });
}

function build(lang) {
  const { document } = parseHTML(source);
  const { dir, code, region } = LANGS[lang];
  const prefix = dir ? '../' : '';

  document.documentElement.setAttribute('lang', lang);
  document.documentElement.dataset.root = prefix;
  document.body.classList.add(`r-${region}`);
  document.getElementById('regCode').textContent = code;

  // International visitors see export right after the "Made in Georgia" block.
  if (lang !== 'ka') document.getElementById('georgian').after(document.getElementById('export'));

  translateDocument(document, lang);
  addHeadTags(document, lang);
  rebase(document, prefix);

  const out = path.join(ROOT, dir, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, '<!DOCTYPE html>\n' + document.documentElement.outerHTML + '\n');
  console.log('✓', path.relative(ROOT, out));
}

for (const lang of Object.keys(LANGS)) build(lang);

const today = new Date().toISOString().slice(0, 10);
const urls = Object.keys(LANGS)
  .map((l) => {
    const alts = Object.keys(LANGS)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${config.baseUrl + LANGS[a].dir}"/>`)
      .join('\n');
    return `  <url>\n    <loc>${config.baseUrl + LANGS[l].dir}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`;
  })
  .join('\n');
fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(ROOT, 'robots.txt'),
  config.indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${config.baseUrl}sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n',
);
console.log('✓ sitemap.xml, robots.txt');

if (missing.size) {
  console.warn(`\n⚠ ${missing.size} Georgian strings have no translation in data/i18n.json:`);
  for (const [k, langs] of missing) console.warn(`  [${[...langs].join(',')}] ${k.slice(0, 90)}`);
}
