/**
 * "Teddy" — a simple scripted chat assistant (no AI).
 * Conversation texts live in data/chatbot.json. An option's action is either the
 * key of the next node or a command:
 *   @catalog[:<filter>]  @pdf  @order  @order-export  @game  @go:<section id>
 */
import { lang, root } from './i18n.js';
import { openOrder } from './order-form.js';
import { openCatalogPdf } from './nav.js';
import { $, $$ } from './util.js';

const TIP_DELAY = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chat, body, tip, script;
let started = false;
let busy = false;

function message(kind, text) {
  const el = document.createElement('div');
  el.className = `msg ${kind}`;
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

async function show(key) {
  busy = true;
  const node = script.nodes[key];
  $$('.opts', body).forEach((o) => o.remove());

  for (const text of node.text) {
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    await sleep(450 + Math.min(700, text.length * 8));
    typing.remove();
    message('bot', text);
  }

  const options = document.createElement('div');
  options.className = 'opts';
  for (const { label, action, main } of node.options) {
    const button = document.createElement('button');
    button.className = 'opt' + (main ? ' main' : '');
    button.textContent = label;
    button.addEventListener('click', () => {
      if (busy) return;
      message('me', label);
      options.remove();
      run(action);
    });
    options.appendChild(button);
  }
  body.appendChild(options);
  body.scrollTop = body.scrollHeight;
  busy = false;
}

function goTo(id) {
  close();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function run(action) {
  if (!action.startsWith('@')) return show(action);
  const [command, arg] = action.slice(1).split(':');
  switch (command) {
    case 'catalog': // "@catalog" or "@catalog:<filter>", e.g. "@catalog:lent"
      close();
      location.hash = arg ? `catalog-${arg}` : 'catalog';
      break;
    case 'pdf':
      openCatalogPdf();
      break;
    case 'order':
      close();
      openOrder('', '');
      break;
    case 'order-export':
      close();
      openOrder('', 'export');
      break;
    case 'game':
      location.href = root + 'game/';
      break;
    case 'go':
      goTo(arg);
      break;
  }
}

function open() {
  chat.classList.add('open');
  tip.classList.remove('show');
  if (!started) {
    started = true;
    body.innerHTML = '';
    show('start');
  }
}

function close() {
  chat.classList.remove('open');
}

export async function initChatbot() {
  chat = $('#cb');
  body = $('#cbBody');
  tip = $('#cbTip');
  script = (await (await fetch(root + 'data/chatbot.json', { cache: 'no-cache' })).json())[lang];

  $('.cb-h b', chat).textContent = script.ui.title;
  $('.cb-h small', chat).textContent = script.ui.status;
  tip.firstChild.textContent = script.ui.greeting;

  $('#cbBtn').addEventListener('click', () => (chat.classList.contains('open') ? close() : open()));
  $('#cbX').addEventListener('click', close);

  let tipDismissed = false;
  tip.addEventListener('click', (e) => {
    if (e.target.id === 'cbTipX') {
      tip.classList.remove('show');
      tipDismissed = true;
    } else open();
  });
  setTimeout(() => !started && !tipDismissed && tip.classList.add('show'), TIP_DELAY);
}
