/**
 * Eigene Oberflächentexte im Inhaltsordner.
 *
 * Die Sprachen stehen in config/site.json — einer Datei des Inhaltsordners.
 * Die Texte dazu kommen aus dem Werkzeug. Ohne eine Möglichkeit, sie im
 * Inhaltsordner zu ergänzen, liesse sich eine Sprache eintragen, für die es
 * keine Texte gibt, und niemand vor Ort könnte das beheben.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SYS } from './paths.mjs';
import { loadI18n, flattenKeys } from './i18n.mjs';

const systemGerman = JSON.parse(fs.readFileSync(path.join(SYS.i18n, 'de.json'), 'utf8'));
const systemEnglish = JSON.parse(fs.readFileSync(path.join(SYS.i18n, 'en.json'), 'utf8'));

/** Eine Konfiguration, wie loadI18n sie braucht. */
const configFor = (...codes) => ({ languageCodes: codes, defaultLanguage: codes[0] });

/** Legt einen i18n-Ordner mit den angegebenen Dateien an. */
function overrides(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-i18n-'));
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  }
  return dir;
}

test('Ohne eigene Datei gelten die Texte des Werkzeugs', () => {
  const i18n = loadI18n(configFor('de', 'en'));
  assert.equal(i18n.for('de')('action.read'), systemGerman.action.read);
});

test('Eine eigene Datei überschreibt nur, was darin steht', () => {
  const dir = overrides({ 'de.json': { action: { order: 'Druckausgabe anfordern' } } });
  const i18n = loadI18n(configFor('de', 'en'), { overrideDir: dir });

  assert.equal(i18n.for('de')('action.order'), 'Druckausgabe anfordern');
  assert.equal(
    i18n.for('de')('action.read'),
    systemGerman.action.read,
    'alles andere bleibt unverändert',
  );
  assert.equal(i18n.for('en')('action.order'), systemEnglish.action.order, 'andere Sprachen bleiben');
});

test('Das Zusammenführen geht in die Tiefe', () => {
  const dir = overrides({ 'de.json': { flyer: { verse: 'Bibelvers' } } });
  const i18n = loadI18n(configFor('de', 'en'), { overrideDir: dir });

  assert.equal(i18n.for('de')('flyer.verse'), 'Bibelvers');
  assert.equal(
    i18n.for('de')('flyer.related'),
    systemGerman.flyer.related,
    'die Geschwister im selben Zweig bleiben erhalten',
  );
});

test('Eine Sprache, die das Werkzeug nicht kennt, lässt sich ergänzen', () => {
  const dir = overrides({ 'it.json': systemGerman });
  const i18n = loadI18n(configFor('de', 'it'), { overrideDir: dir });
  assert.equal(i18n.for('it')('action.read'), systemGerman.action.read);
});

test('Eine unvollständige eigene Sprache nennt jeden fehlenden Schlüssel', () => {
  const dir = overrides({ 'it.json': { action: { read: 'Leggi ora' } } });
  assert.throws(() => loadI18n(configFor('de', 'it'), { overrideDir: dir }), (err) => {
    assert.match(err.message, /stimmen nicht mit "de" überein/);
    assert.match(err.hint, /i18n\/it\.json/);
    assert.match(err.hint, /nav\.flyers/, 'ein konkreter fehlender Schlüssel');
    return true;
  });
});

test('Ganz ohne Texte wird gesagt, wie man sie anlegt', () => {
  assert.throws(() => loadI18n(configFor('de', 'it')), (err) => {
    assert.match(err.message, /Sprache "it" fehlen/);
    assert.match(err.hint, /i18n\/it\.json/);
    assert.match(err.hint, /werkzeug\/src\/i18n\/de\.json/, 'nennt die Vorlage zum Kopieren');
    return true;
  });
});

test('Die mitgelieferten Sprachen haben dieselben Schlüssel', () => {
  const german = flattenKeys(systemGerman).sort();
  const english = flattenKeys(systemEnglish).sort();
  assert.deepEqual(english, german);
});
