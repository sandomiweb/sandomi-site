/** Hero slideshow: cross-fading product slides with a matching background colour. */
import { t } from './i18n.js';
import { $, $$ } from './util.js';

const INTERVAL = 5000;
const EXIT_TIME = 1500; // keep the outgoing slide's exit animation class this long

export function initHero() {
  const slides = $$('.cs');
  const bg = $('#cineBg');
  const dots = $('#cineDots');
  const pause = $('#cinePause');
  if (!slides.length) return;

  let current = 0;
  let timer = null;
  let paused = false;

  const schedule = (delay = INTERVAL) => {
    clearTimeout(timer);
    if (!paused) timer = setTimeout(() => show(current + 1), delay);
  };

  function show(index) {
    const next = (index + slides.length) % slides.length;
    const prev = slides[current];

    if (next !== current) {
      prev.classList.add('out');
      clearTimeout(prev.exitTimer);
      prev.exitTimer = setTimeout(() => prev.classList.remove('out'), EXIT_TIME);
    }
    prev.classList.remove('on');
    dots.children[current].classList.remove('on');

    current = next;
    const slide = slides[current];
    slide.classList.add('on');

    const dot = dots.children[current];
    dot.classList.remove('on');
    void dot.offsetWidth; // restart the progress animation
    dot.classList.add('on');

    bg.style.setProperty('--ca', slide.dataset.a);
    bg.style.setProperty('--cb', slide.dataset.b);
    schedule();
  }

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', `${t.slide} ${i + 1}`);
    dot.addEventListener('click', () => show(i));
    dots.appendChild(dot);
  });

  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? '▶' : '❚❚';
    dots.classList.toggle('paused', paused);
    if (paused) clearTimeout(timer);
    else schedule(2500);
  });

  show(0);
}
