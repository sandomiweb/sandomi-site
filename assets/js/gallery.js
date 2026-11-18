/** Photo gallery: category tabs and arrow buttons for the horizontal strip. */
import { $$ } from './util.js';

export function initGallery() {
  const tabs = $$('.gt');
  const strips = $$('.ggrid');

  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('on', t === tab));
      strips.forEach((s) => (s.hidden = s.id !== tab.dataset.g));
    }),
  );

  $$('.gar').forEach((arrow) =>
    arrow.addEventListener('click', () => {
      const strip = strips.find((s) => !s.hidden);
      strip?.scrollBy({ left: arrow.dataset.d * strip.clientWidth * 0.8, behavior: 'smooth' });
    }),
  );
}
