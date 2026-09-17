/**
 * Lädt und prüft config/site.json.
 *
 * Die Prüfung ist absichtlich streng und läuft vor allem anderen: ein Tippfehler
 * in den Routen soll sofort als deutsche Meldung erscheinen und nicht erst als
 * kaputte URL nach dem Hochladen.
 */
import fs from 'node:fs';
import { FILE } from './paths.mjs';
import { readEnvFile } from './env.mjs';
import { fail } from './log.mjs';
import { createUrls, parseBaseUrl } from './url.mjs';

const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANGUAGE_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/;

const REQUIRED_ROUTE_KEYS = [
  'flyer',
  'read',
  'text',
  'topics',
  'categories',
  'order',
  'contact',
  'about',
  'imprint',
  'privacy',
  'page',
];

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    fail(
      `Die Datei ${file} fehlt.`,
      'Ohne config/site.json weiss der Build nicht, welche Adresse und welche Sprachen die Website hat.',
    );
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(
      `config/site.json ist kein gültiges JSON: ${err.message}`,
      'Häufigste Ursachen: ein Komma zu viel vor einer schliessenden Klammer, oder ein fehlendes Anführungszeichen.',
    );
  }
}

function checkLanguages(raw) {
  if (!Array.isArray(raw.languages) || raw.languages.length === 0) {
    fail('In config/site.json fehlt die Liste "languages".');
  }
  const seen = new Set();
  for (const lang of raw.languages) {
    if (!lang || typeof lang.code !== 'string' || !LANGUAGE_PATTERN.test(lang.code)) {
      fail(`Ungültiger Sprachcode in config/site.json: ${JSON.stringify(lang?.code)}`,
        'Erlaubt sind zweibuchstabige Codes wie "de", "en", "it".');
    }
    if (seen.has(lang.code)) fail(`Die Sprache "${lang.code}" ist in config/site.json doppelt eingetragen.`);
    seen.add(lang.code);
    if (typeof lang.label !== 'string' || lang.label === '') {
      fail(`Der Sprache "${lang.code}" fehlt die Bezeichnung ("label") in config/site.json.`);
    }
  }
  const active = raw.languages.filter((l) => l.enabled !== false);
  if (active.length === 0) {
    fail('In config/site.json ist keine einzige Sprache aktiv ("enabled": true).');
  }
  return active;
}

function checkRoutes(raw, activeLanguages) {
  if (!raw.routes || typeof raw.routes !== 'object') {
    fail('In config/site.json fehlt der Abschnitt "routes".');
  }
  for (const lang of activeLanguages) {
    const table = raw.routes[lang.code];
    if (!table) {
      fail(
        `Für die aktive Sprache "${lang.code}" fehlt eine Routen-Tabelle in config/site.json.`,
        `Ergänze unter "routes" einen Abschnitt "${lang.code}" mit den Segmenten: ${REQUIRED_ROUTE_KEYS.join(', ')}.`,
      );
    }
    const missing = REQUIRED_ROUTE_KEYS.filter((key) => !table[key]);
    if (missing.length > 0) {
      fail(
        `In config/site.json fehlen für die Sprache "${lang.code}" die Routen-Segmente: ${missing.join(', ')}.`,
      );
    }
    const unknown = Object.keys(table).filter((key) => !REQUIRED_ROUTE_KEYS.includes(key));
    if (unknown.length > 0) {
      fail(
        `In config/site.json stehen für die Sprache "${lang.code}" unbekannte Routen-Segmente: ${unknown.join(', ')}.`,
        'Vermutlich ein Tippfehler. Erlaubt sind: ' + REQUIRED_ROUTE_KEYS.join(', ') + '.',
      );
    }
    const used = new Map();
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== 'string' || !SEGMENT_PATTERN.test(value)) {
        fail(
          `Das Routen-Segment "${key}" der Sprache "${lang.code}" ist ungültig: ${JSON.stringify(value)}`,
          'Erlaubt sind nur Kleinbuchstaben, Ziffern und Bindestriche, z. B. "ueber-uns". Keine Umlaute.',
        );
      }
      if (used.has(value)) {
        fail(
          `In der Sprache "${lang.code}" verwenden "${used.get(value)}" und "${key}" beide das Segment "${value}".`,
          'Jedes Routen-Segment muss innerhalb einer Sprache eindeutig sein, sonst überschreiben sich die Seiten.',
        );
      }
      used.set(value, key);
    }
    if (used.has(lang.code)) {
      fail(`Das Routen-Segment "${lang.code}" kollidiert mit dem Sprachpräfix derselben Sprache.`);
    }
  }
}

function checkShortRoutes(raw, activeLanguages) {
  const short = raw.shortRoutes ?? {};
  for (const key of ['flyer', 'reader']) {
    if (typeof short[key] !== 'string' || !SEGMENT_PATTERN.test(short[key])) {
      fail(`In config/site.json fehlt oder stimmt nicht: shortRoutes.${key}`);
    }
  }
  if (short.flyer === short.reader) {
    fail('shortRoutes.flyer und shortRoutes.reader müssen verschieden sein.');
  }
  for (const lang of activeLanguages) {
    for (const [key, value] of Object.entries(short)) {
      if (value === lang.code) {
        fail(
          `Die Kurz-Route "${key}" verwendet "${value}" und kollidiert mit dem Sprachpräfix /${lang.code}/.`,
        );
      }
    }
  }
}

/**
 * Lädt die Konfiguration.
 * @param {object} [options]
 * @param {string} [options.baseUrl] Überschreibt die Adresse, z. B. für die lokale Vorschau.
 * @param {string} [options.file]    Andere Konfigurationsdatei (wird von den Tests genutzt).
 * @param {object} [options.env]     Ersetzt den Inhalt von sftp.env (wird von den Tests genutzt).
 */
export function loadConfig(options = {}) {
  const raw = readJson(options.file ?? FILE.siteConfig);

  const env = options.env ?? readEnvFile(FILE.sftpEnv);
  const baseUrl = options.baseUrl || env.SITE_BASE_URL || raw.baseUrl;
  if (!baseUrl) {
    fail(
      'Es ist keine Adresse konfiguriert.',
      'Trage "baseUrl" in config/site.json ein, z. B. "https://biblia.at/".',
    );
  }
  let parsedBase;
  try {
    parsedBase = parseBaseUrl(baseUrl);
  } catch (err) {
    fail(err.message, 'Die Adresse steht in config/site.json unter "baseUrl".');
  }

  const activeLanguages = checkLanguages(raw);
  checkRoutes(raw, activeLanguages);
  checkShortRoutes(raw, activeLanguages);

  const defaultLanguage = raw.defaultLanguage;
  if (!activeLanguages.some((l) => l.code === defaultLanguage)) {
    fail(
      `Die Standardsprache "${defaultLanguage}" ist nicht aktiv.`,
      `Aktive Sprachen sind: ${activeLanguages.map((l) => l.code).join(', ')}.`,
    );
  }

  if (!Number.isInteger(raw.archive?.perPage) || raw.archive.perPage < 1) {
    fail('archive.perPage in config/site.json muss eine ganze Zahl grösser 0 sein.');
  }

  // Nummern, die es einmal gab und die nie öffentlich waren. Sie dürfen
  // fehlen, ohne dass npm run check das als gebrochene Adresse meldet.
  const retiredFlyerIds = raw.retiredFlyerIds ?? [];
  if (!Array.isArray(retiredFlyerIds) || retiredFlyerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    fail(
      'retiredFlyerIds in config/site.json muss eine Liste positiver ganzer Zahlen sein.',
      'Beispiel:  "retiredFlyerIds": [199, 200]',
    );
  }

  const canonicalDomain = raw.canonicalDomain ?? null;
  const host = new URL(parsedBase.origin).hostname;
  const isCanonical = Boolean(
    canonicalDomain && (host === canonicalDomain || host === `www.${canonicalDomain}`),
  );

  const urls = createUrls({
    baseUrl: `${parsedBase.origin}${parsedBase.basePath}`,
    routes: raw.routes,
    shortRoutes: raw.shortRoutes,
  });

  const languageCodes = activeLanguages.map((l) => l.code);

  return Object.freeze({
    ...raw,
    baseUrl: urls.baseUrl,
    origin: urls.origin,
    basePath: urls.basePath,
    canonicalDomain,
    /** true, sobald die Website unter ihrer endgültigen Domain läuft. */
    isCanonical,
    /** true, solange die Website auf einer Test- oder Zwischenadresse liegt. */
    isStaging: !isCanonical,
    activeLanguages,
    languageCodes,
    defaultLanguage,
    retiredFlyerIds,
    urls,
    /** Ist diese Sprache aktiv? */
    hasLanguage: (code) => languageCodes.includes(code),
  });
}
