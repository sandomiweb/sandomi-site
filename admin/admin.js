/**
 * Sandomi admin panel — entry point: login and navigation between sections.
 * See core.js for how saving works.
 */
import { $, $$, main, esc, auth, rememberToken, gh, REPO, nav } from './core.js';
import { loadProducts, renderList, renderPrices, renderHistory } from './products.js';
import {
  loadContent,
  renderSeason,
  renderVideos,
  renderGallery,
  renderTexts,
  renderNews,
  renderChatbot,
  renderPdf,
} from './sections.js';

const VIEWS = {
  products: renderList,
  prices: renderPrices,
  season: renderSeason,
  videos: renderVideos,
  gallery: renderGallery,
  news: renderNews,
  texts: renderTexts,
  chatbot: renderChatbot,
  pdf: renderPdf,
  history: renderHistory,
};

function setView(view) {
  if (!VIEWS[view]) view = 'products';
  $$('#nav .nav').forEach((n) => n.classList.toggle('on', n.dataset.view === view));
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  window.scrollTo(0, 0);
  dirty = false;
  VIEWS[view]();
}
nav.go = setView;

async function start() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  main.innerHTML = '<div class="loading">იტვირთება…</div>';
  try {
    await Promise.all([loadProducts(), loadContent()]);
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) return showLogin(e.message);
    main.innerHTML = `<div class="empty">${esc(e.message)} <button class="btn ghost" onclick="location.reload()">თავიდან ცდა</button></div>`;
    return;
  }
  setView(location.hash.slice(1));
}

function showLogin(msg = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginErr').hidden = !msg;
  $('#loginErr').textContent = msg;
}

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  auth.token = $('#tokenInput').value.trim();
  try {
    await gh(`/repos/${REPO}`);
  } catch (err) {
    return showLogin(err.message);
  }
  rememberToken(auth.token);
  $('#tokenInput').value = '';
  start();
};

$('#logout').onclick = () => {
  if (!confirm('გავიდე? შემდეგ შესვლისას გასაღების ხელახლა ჩასმა მოგიწევს.')) return;
  rememberToken('');
  showLogin();
};

$$('#nav .nav[data-view]').forEach((n) => (n.onclick = () => setView(n.dataset.view)));

// Warn before closing the page with unsaved edits.
let dirty = false;
document.addEventListener('input', (e) => {
  if (e.target.closest?.('#main')) dirty = true;
});
document.addEventListener('click', (e) => {
  if (e.target.closest?.('#save, #pub')) dirty = false;
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

if (auth.token) start();
else showLogin();
