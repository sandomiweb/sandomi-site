/**
 * Sandomi website — entry point.
 * Plain ES modules, no framework and no bundler: each file handles one part of the page.
 */
import { initNav } from './nav.js';
import { initLanguage } from './language.js';
import { initHero } from './hero.js';
import { initCatalog } from './catalog.js';
import { initProductModal } from './product-modal.js';
import { initOrderForm } from './order-form.js';
import { initRouter } from './router.js';
import { initGallery } from './gallery.js';
import { initMedia } from './media.js';
import { initChatbot } from './chatbot.js';
import { initSeason } from './season.js';

initSeason();
initNav();
initLanguage();
initHero();
initOrderForm();
initGallery();
initMedia();
initChatbot();

await initCatalog();
initProductModal();
initRouter();
