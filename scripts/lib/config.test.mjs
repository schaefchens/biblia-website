import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';

const BASE = JSON.parse(fs.readFileSync(new URL('../../config/site.json', import.meta.url), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-config-'));
let counter = 0;

/** Schreibt eine abgewandelte Konfiguration und lädt sie. */
function withConfig(mutate) {
  const raw = structuredClone(BASE);
  mutate(raw);
  const file = path.join(tmp, `site-${(counter += 1)}.json`);
  fs.writeFileSync(file, JSON.stringify(raw));
  return () => loadConfig({ file, env: {} });
}

test('Die echte Projektkonfiguration ist gültig', () => {
  const config = loadConfig();
  assert.equal(config.basePath, '/v3/');
  assert.deepEqual(config.languageCodes, ['de', 'en']);
  assert.equal(config.defaultLanguage, 'de');
});

test('Die Test-Adresse wird als Staging erkannt', () => {
  assert.equal(loadConfig().isStaging, true);
  assert.equal(loadConfig({ baseUrl: 'https://biblia.at/' }).isCanonical, true);
  assert.equal(loadConfig({ baseUrl: 'https://www.biblia.at/' }).isCanonical, true);
  assert.equal(loadConfig({ baseUrl: 'https://biblia.at.example.com/' }).isStaging, true);
});

test('Fehlendes Routen-Segment wird gemeldet', () => {
  assert.throws(withConfig((c) => delete c.routes.de.read), /Routen-Segmente: read/);
});

test('Tippfehler in den Routen wird gemeldet statt ignoriert', () => {
  assert.throws(withConfig((c) => { c.routes.de.lesen = 'lesen'; }), /unbekannte Routen-Segmente: lesen/);
});

test('Umlaute in Routen-Segmenten werden abgelehnt', () => {
  assert.throws(withConfig((c) => { c.routes.de.about = 'über-uns'; }), /ungültig/);
});

test('Doppelte Routen-Segmente werden abgelehnt', () => {
  assert.throws(withConfig((c) => { c.routes.de.text = 'lesen'; }), /beide das Segment "lesen"/);
});

test('Aktive Sprache ohne Routen-Tabelle wird gemeldet', () => {
  assert.throws(
    withConfig((c) => { c.languages.find((l) => l.code === 'it').enabled = true; delete c.routes.it; }),
    /fehlt eine Routen-Tabelle/,
  );
});

test('Standardsprache muss aktiv sein', () => {
  assert.throws(withConfig((c) => { c.defaultLanguage = 'it'; }), /ist nicht aktiv/);
});

test('Kurz-Routen dürfen nicht mit einem Sprachpräfix kollidieren', () => {
  assert.throws(withConfig((c) => { c.shortRoutes.flyer = 'de'; }), /kollidiert mit dem Sprachpräfix/);
  assert.throws(withConfig((c) => { c.shortRoutes.reader = 'f'; }), /müssen verschieden sein/);
});

test('Ungültige Adresse wird früh gemeldet', () => {
  assert.throws(withConfig((c) => { c.baseUrl = 'biblia.at'; }), /keine gültige Adresse/);
});

test('Keine aktive Sprache wird gemeldet', () => {
  assert.throws(withConfig((c) => { c.languages.forEach((l) => { l.enabled = false; }); }), /keine einzige Sprache aktiv/);
});
