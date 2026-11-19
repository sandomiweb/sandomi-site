/**
 * Seasonal banner: the build renders every banner that is switched on, each with
 * its dates (data-from / data-to, "MM-DD"). Show the one for today, so a banner
 * starts and ends on time even without a new build.
 */
import { $, $$ } from './util.js';

export function initSeason() {
  const section = $('#season');
  if (!section) return;
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const active = (el) => {
    const { from, to } = el.dataset;
    if (!from || !to) return true;
    return from <= to ? md >= from && md <= to : md >= from || md <= to;
  };
  const cards = $$('.season-card', section);
  const pick = cards.find(active);
  cards.forEach((c) => (c.hidden = c !== pick));
  section.hidden = !pick;
}
