/**
 * Videos and map.
 * - YouTube links play in place (privacy-enhanced youtube-nocookie.com player);
 *   titles and thumbnails are read from YouTube, so they follow the channel.
 * - Map pins and the city buttons open an embedded Google Map below the map;
 *   "Google Maps ↗" inside it opens the full map in a new tab.
 * Without a web server (file://) the links simply open YouTube / Google Maps.
 */
import { $, $$ } from './util.js';

const youtubeId = (url) => {
  const m = url.match(/youtu\.be\/([\w-]{11})|v=([\w-]{11})/);
  return m && (m[1] || m[2]);
};

function player(id) {
  const frame = document.createElement('iframe');
  frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.title = 'Sandomi video';
  frame.className = 'yt';
  return frame;
}

function initVideos() {
  const links = $$('a.video, a.vc');

  links.forEach((link) => {
    const id = youtubeId(link.href);
    if (!id) return;
    const isCard = link.classList.contains('vc');
    if (isCard) $('.vp', link).style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;

    fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
      .then((r) => r.json())
      .then((info) => {
        const label = isCard ? $('.vt', link) : $('small', link);
        if (info?.title && label) label.textContent = label.title = info.title;
      })
      .catch(() => {});

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = isCard ? $('.vp', link) : link;
      target.innerHTML = '';
      if (!isCard) target.style.background = '#000';
      target.appendChild(player(id));
      link.classList.add('playing');
    });
  });
}

function initMap() {
  const map = $('.map');
  if (!map) return;
  const box = document.createElement('div');
  box.className = 'gframe';
  box.hidden = true;
  map.appendChild(box);

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.map a[href*="google.com/maps"]');
    if (!link || link.classList.contains('gopen')) return; // "Google Maps ↗" opens normally
    e.preventDefault();
    const url = new URL(link.getAttribute('href'), document.baseURI); // SVG links: read the attribute
    const query = url.searchParams.get('query');
    box.innerHTML = `
      <iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Maps"
        src="https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed"></iframe>
      <a class="gopen" href="${url.href}" target="_blank" rel="noopener">Google Maps ↗</a>`;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

export function initMedia() {
  if (location.protocol === 'file:') return;
  initVideos();
  initMap();
}
