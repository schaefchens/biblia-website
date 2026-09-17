/**
 * Oberflächentexte je Sprache.
 *
 * Ein fehlender Schlüssel ist ein Build-Fehler, kein leerer Text auf der
 * Seite — sonst fällt eine vergessene Übersetzung erst dem Besucher auf.
 *
 * Die Vorgaben kommen aus dem Werkzeug. Der Inhaltsordner darf sie in
 * i18n/<sprache>.json ergänzen oder überschreiben — nur so lässt sich eine
 * Sprache aufnehmen, für die das Werkzeug noch keine Texte mitbringt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SYS } from './paths.mjs';
import { fail } from './log.mjs';

/** Wandelt verschachtelte Objekte in eine flache Liste von Schlüsselpfaden. */
export function flattenKeys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function readJsonFile(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`${label} ist kein gültiges JSON: ${err.message}`);
  }
}

/** Tiefes Zusammenführen — der Inhaltsordner gewinnt, Zweig für Zweig. */
function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    const bothObjects =
      value && typeof value === 'object' && !Array.isArray(value) &&
      existing && typeof existing === 'object' && !Array.isArray(existing);
    out[key] = bothObjects ? merge(existing, value) : value;
  }
  return out;
}

function readStrings(lang, overrideDir, referenceLang) {
  const systemFile = path.join(SYS.i18n, `${lang}.json`);
  const homeFile = overrideDir ? path.join(overrideDir, `${lang}.json`) : null;
  const hasSystem = fs.existsSync(systemFile);
  const hasHome = Boolean(homeFile && fs.existsSync(homeFile));

  if (!hasSystem && !hasHome) {
    fail(
      `Die Oberflächentexte für die Sprache "${lang}" fehlen.`,
      `Das Werkzeug bringt für "${lang}" keine Texte mit.\n` +
        `  Lege im Inhaltsordner die Datei i18n/${lang}.json an — am einfachsten\n` +
        `  als Kopie von werkzeug/src/i18n/${referenceLang}.json, dann übersetzen.`,
    );
  }

  const base = hasSystem ? readJsonFile(systemFile, `src/i18n/${lang}.json`) : {};
  return hasHome ? merge(base, readJsonFile(homeFile, `i18n/${lang}.json`)) : base;
}

/** Setzt Platzhalter der Form {name} ein. */
function interpolate(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/**
 * Baut die Übersetzungsfunktionen für alle aktiven Sprachen.
 * Prüft dabei, dass jede Sprache dieselben Schlüssel hat.
 */
export function loadI18n(config, { overrideDir = null } = {}) {
  const byLanguage = new Map();
  for (const lang of config.languageCodes) {
    byLanguage.set(lang, readStrings(lang, overrideDir, config.defaultLanguage));
  }

  const reference = config.defaultLanguage;
  const referenceKeys = flattenKeys(byLanguage.get(reference));
  for (const [lang, strings] of byLanguage) {
    if (lang === reference) continue;
    const keys = flattenKeys(strings);
    const missing = referenceKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !referenceKeys.includes(k));
    if (missing.length > 0 || extra.length > 0) {
      const parts = [];
      if (missing.length > 0) parts.push(`fehlen: ${missing.join(', ')}`);
      if (extra.length > 0) parts.push(`zu viel: ${extra.join(', ')}`);
      fail(
        `Die Oberflächentexte für "${lang}" stimmen nicht mit "${reference}" überein.`,
        `${parts.join(' — ')}\n` +
          `  Ergänzen lässt sich das im Inhaltsordner in i18n/${lang}.json.`,
      );
    }
  }

  /** Übersetzungsfunktion für eine Sprache. */
  function translator(lang) {
    const strings = byLanguage.get(lang);
    const t = (key, values = {}) => {
      const text = key.split('.').reduce((node, part) => node?.[part], strings);
      if (typeof text !== 'string') {
        fail(
          `Der Oberflächentext "${key}" fehlt für die Sprache "${lang}".`,
          `Ergänze ihn im Inhaltsordner in i18n/${lang}.json.`,
        );
      }
      return interpolate(text, values);
    };
    /** Zahlwort mit Ein- und Mehrzahl: t.plural('flyer.pages', 8). */
    t.plural = (baseKey, count, values = {}) =>
      t(`${baseKey}${count === 1 ? 'One' : 'Other'}`, { n: count, ...values });
    t.lang = lang;
    return t;
  }

  const translators = new Map(config.languageCodes.map((lang) => [lang, translator(lang)]));
  return {
    byLanguage,
    for: (lang) => {
      const t = translators.get(lang);
      if (!t) fail(`Für die Sprache "${lang}" gibt es keine Oberflächentexte.`);
      return t;
    },
  };
}
