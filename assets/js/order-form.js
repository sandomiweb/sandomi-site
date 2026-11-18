/**
 * Order request form (modal). Any element with [data-order] opens it;
 * data-order holds the product label to add, data-type="export" preselects export.
 *
 * Requests are sent with FormSubmit (https://formsubmit.co). The first request to
 * each address triggers a one-time activation email ("Activate Form").
 * If sending fails, the visitor's email app opens with the same text.
 */
import { t } from './i18n.js';
import { $, setOpen, toast } from './util.js';

const RECIPIENTS = {
  domestic: 'sandomi.tbilisi@gmail.com',
  export: 'sandomiproducts@gmail.com',
};
const EXPORT_TYPE = 'ექსპორტი'; // value of the "export" radio button

let modal, products;

/** Adds a product on its own line; a product that is already listed is left as is. */
export function addProduct(label) {
  const lines = products.value.split('\n');
  const listed = lines.some((line) => line.split('—')[0].trim() === label.trim());
  if (listed) return;
  const current = products.value.replace(/\n+$/, '');
  products.value = (current ? current + '\n' : '') + label + ' — ';
}

export function openOrder(label = '', type = '') {
  if (label) addProduct(label);
  if (type === 'export') $(`#seg input[value="${EXPORT_TYPE}"]`).checked = true;
  setOpen(modal, true);
}

const closeOrder = () => setOpen(modal, false);

async function submit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  if (data.get('_honey')) return; // spam bot

  const type = data.get('t') || '';
  const to = type === EXPORT_TYPE ? RECIPIENTS.export : RECIPIENTS.domestic;
  const fields = {
    ტიპი: type,
    კომპანია: data.get('company'),
    'საკონტაქტო პირი': data.get('person'),
    ტელეფონი: data.get('phone'),
    ელფოსტა: data.get('email') || '—',
    'ქალაქი / ქვეყანა': data.get('city') || '—',
    პროდუქცია: data.get('products') || '—',
    ენა: document.documentElement.lang,
  };
  const subject = `შეკვეთის მოთხოვნა: ${data.get('company') || ''} (${type})`;

  const button = $('#oSend');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t.sending;

  let ok = false;
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${to}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        ...(data.get('email') ? { _replyto: data.get('email') } : {}),
        ...fields,
      }),
    });
    ok = String((await res.json()).success) === 'true';
  } catch {
    ok = false;
  }

  button.disabled = false;
  button.textContent = label;

  if (ok) {
    form.reset();
    closeOrder();
    toast(t.sent);
  } else {
    const body = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast(t.mailFallback);
  }
}

export function initOrderForm() {
  modal = $('#modal');
  products = $('#mProducts');

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-order]');
    if (!trigger) return;
    e.preventDefault();
    openOrder(trigger.dataset.order, trigger.dataset.type);
  });
  $('#mClose').addEventListener('click', closeOrder);
  modal.addEventListener('click', (e) => e.target === modal && closeOrder());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeOrder());
  $('#orderForm').addEventListener('submit', submit);
}
