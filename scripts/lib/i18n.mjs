/**
 * Oberflächentexte je Sprache.
 *
 * Ein fehlender Schlüssel ist ein Build-Fehler, kein leerer Text auf der
 * Seite — sonst fällt eine vergessene Übersetzung erst dem Besucher auf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR } from './paths.mjs';
import { fail } from './log.mjs';

/** Wandelt verschachtelte Objekte in eine flache Liste von Schlüsselpfaden. */
export function flattenKeys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function readStrings(lang) {
  const file = path.join(DIR.i18n, `${lang}.json`);
  if (!fs.existsSync(file)) {
    fail(
      `Die Oberflächentexte für die Sprache "${lang}" fehlen.`,
      `Erwartet wird die Datei src/i18n/${lang}.json.`,
    );
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`src/i18n/${lang}.json ist kein gültiges JSON: ${err.message}`);
  }
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
export function loadI18n(config) {
  const byLanguage = new Map();
  for (const lang of config.languageCodes) {
    byLanguage.set(lang, readStrings(lang));
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
        `Die Oberflächentexte in src/i18n/${lang}.json stimmen nicht mit ${reference}.json überein.`,
        parts.join(' — '),
      );
    }
  }

  /** Übersetzungsfunktion für eine Sprache. */
  function translator(lang) {
    const strings = byLanguage.get(lang);
    const t = (key, values = {}) => {
      const text = key.split('.').reduce((node, part) => node?.[part], strings);
      if (typeof text !== 'string') {
        fail(`Der Oberflächentext "${key}" fehlt in src/i18n/${lang}.json.`);
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
