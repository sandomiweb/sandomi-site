/**
 * Builds the language pages from src/index.html:
 *   index.html (ქართული) · en/index.html · ru/index.html · sitemap.xml · robots.txt
 * and the topic pages listed in data/seo.json (/vafli/, /tklapi/, ... in each
 * language). A topic page is the same page opened in the catalog view with its
 * own selection, title, description and a short introduction for search engines.
 *
 * Usage: npm run build
 *
 * Translation: every text node and the alt / placeholder / aria-label / title
 * attributes whose Georgian text is found in data/i18n.json are replaced.
 * Strings created by JavaScript are translated in assets/js/i18n.js.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));

const LANGS = {
  ka: { dir: '', code: 'ქა', region: 'ge', locale: 'ka_GE' },
  en: { dir: 'en/', code: 'EN', region: 'intl', locale: 'en_US' },
  ru: { dir: 'ru/', code: 'RU', region: 'cis', locale: 'ru_RU' },
};
const ATTRS = ['alt', 'placeholder', 'aria-label', 'title'];
// Mkhedruli/Asomtavruli plus Mtavruli (Georgian capitals).
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿ]/;
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

/** Path of a page from the site root: "", "en/", "vafli/", "en/vafli/". */
const pagePath = (lang, slug) => LANGS[lang].dir + (slug ? `${slug}/` : '');

function addHeadTags(document, lang, slug) {
  const head = document.head;
  const url = (l) => config.baseUrl + pagePath(l, slug);
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

/** Short content hash of the CSS and JS files, used to bust browser caches after each change. */
const ASSET_DIRS = ['assets/css', 'assets/js'];
const assetFiles = ASSET_DIRS.flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((f) => `${d}/${f}`));
const version = crypto
  .createHash('sha1')
  .update(assetFiles.map((f) => fs.readFileSync(path.join(ROOT, f))).join(''))
  .digest('hex')
  .slice(0, 8);

/**
 * Adds ?v=<hash> to the stylesheet and the scripts, so visitors get the new version right after a change.
 * The import map versions the JS modules that main.js imports (keys resolve against the page URL).
 */
function versionAssets(document, prefix) {
  const css = document.querySelector('link[href$="assets/css/main.css"]');
  css.setAttribute('href', `${css.getAttribute('href')}?v=${version}`);

  const modules = assetFiles.filter((f) => f.endsWith('.js'));
  // Keys must look like URLs ("./" or "../"), otherwise browsers treat them as bare package names.
  const base = prefix || './';
  const imports = Object.fromEntries(modules.map((f) => [base + f, `${base}${f}?v=${version}`]));
  const map = document.createElement('script');
  map.setAttribute('type', 'importmap');
  map.textContent = JSON.stringify({ imports });

  const main = document.querySelector('script[src$="assets/js/main.js"]');
  main.before(map);
  main.setAttribute('src', `${main.getAttribute('src')}?v=${version}`);
}

/** Products shown on a topic page: a category, a word in the name, or packed products of some categories. */
function topicProducts(page) {
  if (page.filter) return products.filter((p) => p.category === page.filter);
  if (typeof page.match === 'string') return products.filter((p) => p.name.ka.includes(page.match));
  const { categories, packed } = page.match;
  return products.filter((p) => categories.includes(p.category) && (!packed || p.unit !== 'kg'));
}

const nameIn = (p, lang) => p.name[lang] || p.name.ka;

/** Structured data for search engines (schema.org JSON-LD). */
function addStructuredData(document, lang, page) {
  const brand = { '@type': 'Brand', name: 'Sandomi' };
  const data = page
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: page[lang].h1,
        itemListElement: topicProducts(page).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: nameIn(p, lang),
            brand,
            ...(p.image && { image: config.baseUrl + p.image }),
            ...(/^\d{13}$/.test(p.code) && { gtin13: p.code }),
            ...(p.code && { sku: p.code }),
            ...(p.price && { offers: { '@type': 'Offer', price: p.price, priceCurrency: 'GEL' } }),
          },
        })),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sandomi',
        alternateName: ['სანდომი', 'Сандоми'],
        legalName: 'შპს „ვასაძის პური“',
        url: config.baseUrl,
        logo: config.baseUrl + 'assets/img/brand/logo.svg',
        foundingDate: '2001',
        sameAs: [...document.querySelectorAll('footer a[href^="https://"]')]
          .map((a) => a.getAttribute('href'))
          .filter((h) => /instagram|facebook|tiktok|linkedin|youtube/.test(h)),
      };
  const script = document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

/** Title, description and the visible introduction of a topic page; links between pages. */
function applySeo(document, lang, page) {
  const text = page ? page[lang] : seo.home[lang];
  document.title = text.title;
  document.querySelector('meta[name="description"]').setAttribute('content', text.description);
  document.querySelector('meta[property="og:title"]').setAttribute('content', text.title);
  document.querySelector('meta[property="og:description"]').setAttribute('content', text.description);

  // Category links point to their topic page (the page script keeps them in-page).
  const siteRoot = '../'.repeat(pagePath(lang, page?.slug).split('/').filter(Boolean).length);
  for (const a of document.querySelectorAll('a[data-filter]')) {
    const target = seo.pages.find((p) => p.filter === a.dataset.filter);
    if (target) a.setAttribute('href', siteRoot + pagePath(lang, target.slug));
  }
  if (!page) return;

  const html = document.documentElement;
  // Start in the catalog view, so the page does not jump when the script loads.
  document.body.classList.add('catmode');
  if (page.filter) html.dataset.filter = page.filter;
  else
    html.dataset.codes = topicProducts(page)
      .map((p) => p.code)
      .join(',');

  // The logo leads to the home page; the language options to this topic in that language.
  document.querySelector('header .logo').setAttribute('href', siteRoot + pagePath(lang, ''));
  for (const a of document.querySelectorAll('.reg-o[data-lang]')) {
    a.setAttribute('href', siteRoot + pagePath(a.dataset.lang, page.slug) || './');
  }

  const intro = document.createElement('div');
  intro.className = 'seo-intro';
  const h1 = document.createElement('h1');
  h1.textContent = text.h1;
  const p = document.createElement('p');
  p.textContent = text.intro;
  intro.append(h1, p);
  document.querySelector('#products .prod-head').before(intro);
}

function build(lang, page) {
  const { document } = parseHTML(source);
  const { code, region } = LANGS[lang];
  const depth = pagePath(lang, page?.slug).split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);

  document.documentElement.setAttribute('lang', lang);
  document.documentElement.dataset.root = prefix;
  document.body.classList.add(`r-${region}`);
  document.getElementById('regCode').textContent = code;

  // International visitors see export right after the "Made in Georgia" block.
  if (lang !== 'ka') document.getElementById('georgian').after(document.getElementById('export'));

  translateDocument(document, lang);
  addHeadTags(document, lang, page?.slug);
  rebase(document, prefix);
  applySeo(document, lang, page);
  addStructuredData(document, lang, page);
  versionAssets(document, prefix);

  const out = path.join(ROOT, pagePath(lang, page?.slug), 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, '<!DOCTYPE html>\n' + document.documentElement.outerHTML + '\n');
  console.log('✓', path.relative(ROOT, out));
}

const slugs = ['', ...seo.pages.map((p) => p.slug)];
for (const lang of Object.keys(LANGS)) {
  build(lang);
  for (const page of seo.pages) build(lang, page);
}

const today = new Date().toISOString().slice(0, 10);
const urls = slugs
  .flatMap((slug) => Object.keys(LANGS).map((l) => [l, slug]))
  .map(([l, slug]) => {
    const alts = Object.keys(LANGS)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${config.baseUrl + pagePath(a, slug)}"/>`)
      .join('\n');
    return `  <url>\n    <loc>${config.baseUrl + pagePath(l, slug)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`;
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
