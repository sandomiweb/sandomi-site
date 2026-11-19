// Browser tests for the site, on a phone-sized screen. Run with `npm test`.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const products = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url)));

/** Count of product cards currently visible in the grid / carousel. */
const visibleCards = (page) => page.locator('#grid .p:not(.hide)');
/** Card indices in the order the home carousel shows them. */
const carouselOrder = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#grid .p:not(.hide)')]
      .sort((a, b) => a.style.getPropertyValue('--o') - b.style.getPropertyValue('--o'))
      .map((c) => c.dataset.ix)
      .join(),
  );
const isOpen = (page, id) => page.evaluate((el) => document.getElementById(el).classList.contains('open'), id);

test.beforeEach(async ({ page }, info) => {
  // Keep tests offline: YouTube, Google Maps, fonts and FormSubmit are not needed.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  // Every test except the first-visit one starts with a language already chosen.
  if (!info.title.includes('first visit')) {
    await page.addInitScript(() => localStorage.setItem('sandomi_lang', localStorage.getItem('sandomi_lang') || 'en'));
  }
});

test.describe('language', () => {
  test('first visit asks for the language, choice opens that page', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#regModal')).toHaveClass(/open/);
    await page.click('.reg-o[data-lang="en"]');
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#regModal')).not.toHaveClass(/open/);
  });

  for (const [from, to, url] of [
    ['en/', 'ka', '/'],
    ['en/', 'ru', '/ru/'],
    ['ru/', 'ka', '/'],
    ['ru/', 'en', '/en/'],
    ['', 'ru', '/ru/'],
  ]) {
    test(`switch ${from || 'ka/'} → ${to}`, async ({ page, baseURL }) => {
      await page.goto(from);
      await page.click('#regBtn');
      await page.click(`.reg-o[data-lang="${to}"]`);
      await expect(page).toHaveURL(new URL(url.slice(1), baseURL).href);
      await expect(page.locator('html')).toHaveAttribute('lang', to);
    });
  }

  for (const path of ['en/', 'en/tklapi/']) {
    test(`English page ${path} has no Georgian text left`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle'); // chat texts arrive with data/chatbot.json
      const leftovers = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const found = [];
        for (let n; (n = walker.nextNode());) {
          const el = n.parentElement;
          if (!el || el.closest('script, style, #regModal, #mProducts') || !el.checkVisibility()) continue;
          if (/[ა-ჿᲐ-Ჿ]/.test(n.nodeValue)) found.push(n.nodeValue.trim().slice(0, 50));
        }
        return found;
      });
      expect(leftovers).toEqual([]);
    });
  }

  test('Russian page', async ({ page }) => {
    await page.goto('ru/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('#chips')).toContainText('Вафли');
  });
});

test.describe('home carousel', () => {
  test('shows every packaged product, photos preloaded, random order per visit', async ({ page }) => {
    await page.goto('en/');
    await expect(page.locator('#grid .p')).toHaveCount(products.length);
    const packaged = products.filter((p) => p.image && p.unit !== 'kg' && p.carousel !== false).length;
    await expect(visibleCards(page)).toHaveCount(packaged);

    const grid = page.locator('#grid');
    await grid.scrollIntoViewIfNeeded();
    await expect
      .poll(() => visibleCards(page).evaluateAll((cards) => cards.every((c) => c.querySelector('img')?.complete)), {
        message: 'all carousel photos load in advance, not only when swiped to',
      })
      .toBe(true);

    const first = await carouselOrder(page);
    await page.reload();
    expect(await carouselOrder(page)).not.toBe(first);
  });
});

test.describe('catalog', () => {
  test('category filter, count, show more, search', async ({ page }) => {
    await page.goto('en/#catalog-wafer');
    await expect(page.locator('#grid .p')).toHaveCount(products.length); // catalog data loaded
    await expect(page.locator('#pcount')).toHaveText(/products$/);
    const cats = await visibleCards(page).evaluateAll((cards) => cards.map((c) => c.dataset.cat));
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c.includes('wafer'))).toBe(true);

    await page.evaluate(() => (location.hash = 'catalog'));
    await expect(visibleCards(page)).toHaveCount(12);
    await page.click('#pmore');
    await expect(visibleCards(page)).toHaveCount(24);

    await page.fill('#pq', '4860103232373');
    await expect(visibleCards(page)).toHaveCount(1);
  });

  test('logo returns from the catalog to the home page', async ({ page }) => {
    await page.goto('en/#catalog');
    await page.click('header .logo');
    await expect(page.locator('body')).not.toHaveClass(/catmode/);
  });
});

test('desktop: every catalog category chip is reachable with a mouse', async ({ browser, baseURL }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem('sandomi_lang', 'ka'));
  await page.goto(new URL('#catalog', baseURL).href);
  await expect(page.locator('body')).toHaveClass(/catmode/);
  const hidden = await page.$$eval('#chips .chip', (chips) => {
    const box = document.getElementById('chips').getBoundingClientRect();
    return chips.filter((c) => c.getBoundingClientRect().right > box.right + 1).map((c) => c.textContent.trim());
  });
  expect(hidden).toEqual([]);
  await page.close();
});

test.describe('product dialog', () => {
  test('opens, orders, and the order list keeps products unique', async ({ page }) => {
    await page.goto('en/#catalog');
    await page.click('#grid .p:not(.hide) h3');
    await expect(page.locator('#pm')).toHaveClass(/open/);
    await expect(page.locator('#pm')).toContainText('Order request');

    await page.click('.pm-order');
    await expect(page.locator('#modal')).toHaveClass(/open/);
    await expect(page.locator('#mProducts')).toHaveValue(/—\s*$/);
    await page.click('#mClose');

    await page.evaluate(() => {
      const button = document.querySelector('.hdr-order');
      for (const name of ['A', 'A B', 'A']) {
        button.dataset.order = name;
        button.click();
        document.getElementById('mClose').click();
      }
    });
    const list = await page.locator('#mProducts').inputValue();
    expect(list.split('A —').length - 1).toBe(1);
    expect(list).toContain('A B —');
  });

  test('close button stays in reach; back closes the dialog, then returns home', async ({ page }) => {
    await page.goto('en/');
    const link = page.locator('a[data-filter="choco"].btn-gold');
    await link.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await link.click();
    await expect(page.locator('body')).toHaveClass(/catmode/);
    await page.locator('#grid .p[data-cat*="choco"]:not(.hide)').first().click();
    await expect(page.locator('#pm')).toHaveClass(/open/);

    await page.locator('.pm-box').evaluate((box) => (box.scrollTop = 2000));
    const [xTop, boxTop] = await page.evaluate(() => [
      document.querySelector('.pm-x').getBoundingClientRect().top,
      document.querySelector('.pm-box').getBoundingClientRect().top,
    ]);
    expect(xTop).toBeGreaterThanOrEqual(boxTop);

    await page.goBack();
    await expect(page.locator('#pm')).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/#catalog-choco$/);

    await page.goBack();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, -1);
  });
});

test.describe('page features', () => {
  test('gallery tabs, map, video, chat assistant', async ({ page }) => {
    await page.goto('en/');

    await page.click('.gt[data-g="g-tv"]');
    await expect(page.locator('#g-tv')).toBeVisible();
    await expect(page.locator('#g-exp')).toBeHidden();

    await page.evaluate(() => document.querySelector('.map-btns a').click());
    await expect(page.locator('.gframe iframe')).toHaveAttribute('src', /Ponichala/);

    await page.evaluate(() => document.querySelector('a.vc').click());
    await expect(page.locator('a.vc iframe.yt')).toHaveCount(1);

    await page.click('#cbBtn');
    await expect(page.locator('#cb')).toContainText('Teddy');
    await page.locator('.opt').nth(1).click();
    await page.locator('.opt.main').click();
    expect(await isOpen(page, 'modal')).toBe(true);
  });

  test('icons, layout width and images', async ({ page }) => {
    await page.goto('en/');
    const iconPaths = await page.$$eval('use', (uses) => uses.map((u) => u.getAttribute('href')));
    expect(iconPaths.every((h) => h.startsWith('../assets/img/icons.svg#'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await page.goto('./');
    await page.waitForLoadState('networkidle');
    const broken = await page.$$eval('img', (imgs) =>
      imgs.filter((i) => i.complete && i.naturalWidth === 0 && !i.src.includes('ytimg')).map((i) => i.src),
    );
    expect(broken).toEqual([]);
  });

  test('PDF catalog is available', async ({ request }) => {
    expect((await request.get('catalog/sandomi-catalog-2026.pdf')).ok()).toBe(true);
  });
});

test('chat assistant: Lenten answer opens all Lenten products', async ({ page }) => {
  await page.goto('en/');
  await page.click('#cbBtn');
  await page.locator('.opt', { hasText: 'Products' }).last().click();
  await page.locator('.opt', { hasText: 'Lenten' }).last().click();
  await expect(page.locator('#cb')).toContainText('More than half');
  await page.locator('.opt.main', { hasText: 'Lenten' }).last().click();
  await expect(page).toHaveURL(/#catalog-lent$/);
  await expect(page.locator('#pcount')).toHaveText(`${products.filter((p) => p.lenten).length} products`);
});

test.describe('topic pages for search engines', () => {
  const topics = JSON.parse(readFileSync(new URL('../data/seo.json', import.meta.url))).pages;

  test('each topic page opens its selection with a heading and introduction', async ({ page }) => {
    for (const lang of ['', 'en/', 'ru/']) {
      for (const topic of topics) {
        await page.goto(`${lang}${topic.slug}/`);
        await expect(page.locator('body')).toHaveClass(/catmode/);
        const text = topic[lang ? lang.slice(0, 2) : 'ka'];
        await expect(page.locator('.seo-intro h1')).toHaveText(text.h1);
        await expect(page).toHaveTitle(text.title);
        const shown = await visibleCards(page).count();
        expect(shown, `${lang}${topic.slug}: products shown`).toBeGreaterThan(0);
        if (topic.filter) {
          const cats = await visibleCards(page).evaluateAll((cards) => cards.map((c) => c.dataset.cat));
          expect(cats.every((c) => c.split(' ').includes(topic.filter))).toBe(true);
        }
      }
    }
  });

  test('canonical and language versions point to the same topic', async ({ page }) => {
    await page.goto('en/tklapi/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/tklapi\/$/);
    await expect(page.locator('link[hreflang="ru"]')).toHaveAttribute('href', /\/ru\/tklapi\/$/);
    await page.click('#regBtn');
    await page.click('.reg-o[data-lang="ru"]');
    await expect(page).toHaveURL(/\/ru\/tklapi\/$/);
    await expect(page.locator('.seo-intro h1')).toHaveText('Пастила тклапи');
  });

  test('logo leads home; the home page itself is unchanged', async ({ page }) => {
    await page.goto('vafli/');
    await page.click('header .logo');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('body')).not.toHaveClass(/catmode/);
    await expect(page.locator('.seo-intro')).toHaveCount(0);
  });

  test('category links on the home page still open in place', async ({ page }) => {
    await page.goto('en/');
    await page.evaluate(() => (window.__samePage = true));
    await page.locator('a.cat[data-filter="wafer"]').click();
    await expect(page).toHaveURL(/\/en\/#catalog-wafer$/);
    expect(await page.evaluate(() => window.__samePage)).toBe(true);
    await expect(page.locator('.chip.on')).toHaveAttribute('data-f', 'wafer');
  });

  test('sitemap lists every topic page in every language', async ({ request }) => {
    const xml = await (await request.get('sitemap.xml')).text();
    for (const topic of topics)
      for (const lang of ['', 'en/', 'ru/']) expect(xml).toContain(`/${lang}${topic.slug}/</loc>`);
  });
});

test.describe('game', () => {
  test('loads, starts, and links back to the site', async ({ page }) => {
    await page.goto('game/');
    await page.mouse.click(195, 400);
    await page.waitForLoadState('networkidle');
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length);
    expect(broken).toBe(0);

    await page.click('#playBtn');
    await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
    await page.click('#home');
    await expect(page).toHaveURL(/\/#game$/);
  });

  test('old game address redirects', async ({ page }) => {
    await page.goto('sandomi-tkbili-nakhtomi.html');
    await expect(page).toHaveURL(/\/game\/$/);
  });
});

test('no JavaScript errors on the three language pages', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('ERR_') && errors.push(m.text()));
  for (const path of ['./', 'en/', 'ru/', 'tklapi/', 'en/vafli/', 'ru/saakhaltslo/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});
