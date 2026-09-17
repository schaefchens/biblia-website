/**
 * Ein kleines Inhaltsverzeichnis im temporären Ordner — nur für die Tests.
 *
 * Damit hängen die Prüfungen nicht an den Beispielinhalten unter content/,
 * die sich jederzeit ändern dürfen.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { loadContent } from './content.mjs';

export const SITE = {
  siteName: 'Testsite',
  baseUrl: 'https://beispiel.test/v3/',
  canonicalDomain: 'beispiel.test',
  defaultLanguage: 'de',
  languages: [
    { code: 'de', label: 'Deutsch', enabled: true },
    { code: 'en', label: 'English', enabled: true },
  ],
  routes: {
    de: {
      flyer: 'flyer', read: 'lesen', text: 'text', topics: 'themen', categories: 'kategorien',
      order: 'bestellen', contact: 'kontakt', about: 'ueber-uns', imprint: 'impressum',
      privacy: 'datenschutz', page: 'seite',
    },
    en: {
      flyer: 'flyer', read: 'read', text: 'text', topics: 'topics', categories: 'categories',
      order: 'order', contact: 'contact', about: 'about', imprint: 'imprint',
      privacy: 'privacy', page: 'page',
    },
  },
  shortRoutes: { flyer: 'f', reader: 'r' },
  archive: { perPage: 24 },
  // Absichtlich klein: die Tests sollen schnell bleiben.
  images: {
    renderWidth: 400,
    coverWidths: [160],
    readerWidths: [320],
    formats: ['webp'],
    quality: { webp: 70, avif: 50 },
    lqipWidth: 8,
  },
  share: {
    imageSize: { width: 240, height: 126 },
    statusSize: { width: 108, height: 192 },
  },
  order: {
    enabled: true,
    defaultCurrency: 'EUR',
    defaultMaxQuantity: 100,
    recipientEmail: 'bestellung@beispiel.at',
    senderEmail: 'website@beispiel.at',
  },
  contact: { enabled: true, recipientEmail: 'kontakt@beispiel.at' },
  organization: { name: 'Testsite', email: 'kontakt@beispiel.at' },
};

/** Kopf einer flyer.md mit den üblichen Angaben. */
export const sharedFrontmatter = ({ id = 101, slug = 'hoffnung', extra = '' } = {}) =>
  `---\nid: ${id}\nslug: ${slug}\ncategory: leben\nstatus: published\n${extra}---\n`;

/**
 * Legt Inhalte an und liest sie ein.
 *
 * @param {Array<object>} flyers   [{ dirName, shared, languages?, pdfs?, texts? }]
 * @param {object} [options]
 * @param {object} [options.pages] { imprint: '---\ntitle: …\n---\n…' }
 * @param {object} [options.site]  Ergänzungen zur Konfiguration
 */
export function fixture(flyers, { pages = {}, categories = ['leben'], topics = ['hoffnung'], site = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-fixture-'));
  const dirs = {
    flyers: path.join(root, 'flyers'),
    pages: path.join(root, 'pages'),
    topics: path.join(root, 'topics'),
    categories: path.join(root, 'categories'),
  };
  for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });

  for (const slug of categories) {
    fs.writeFileSync(path.join(dirs.categories, `${slug}.de.md`), `---\ntitle: ${slug}\n---\n`);
  }
  for (const slug of topics) {
    fs.writeFileSync(path.join(dirs.topics, `${slug}.de.md`), `---\ntitle: ${slug}\n---\n`);
  }
  for (const [name, body] of Object.entries(pages)) {
    for (const lang of ['de', 'en']) {
      fs.writeFileSync(path.join(dirs.pages, `${name}.${lang}.md`), body);
    }
  }

  for (const flyer of flyers) {
    const dir = path.join(dirs.flyers, flyer.dirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'flyer.md'), flyer.shared);
    for (const [lang, text] of Object.entries(flyer.languages ?? { de: '---\ntitle: Titel\ndescription: Kurz.\n---\n' })) {
      fs.writeFileSync(path.join(dir, `flyer.${lang}.md`), text);
    }
    for (const lang of flyer.pdfs ?? ['de']) {
      fs.writeFileSync(path.join(dir, `flyer.${lang}.pdf`), '%PDF-1.4\n');
    }
    for (const [lang, text] of Object.entries(flyer.texts ?? {})) {
      fs.writeFileSync(path.join(dir, `flyer.${lang}.txt`), text);
    }
  }

  const configFile = path.join(root, 'site.json');
  fs.writeFileSync(configFile, JSON.stringify({ ...SITE, ...site }));
  const config = loadConfig({ file: configFile, env: {} });
  return { config, content: loadContent(config, { dirs }), dirs, root };
}

/** Alle Meldungen als ein Text — für lesbare Fehlausgaben in den Tests. */
export const messagesOf = (content) => content.issues.items.map((i) => i.message).join('\n');
