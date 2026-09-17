import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { SYS } from './paths.mjs';

// Die Vorlage, aus der auch ein neuer Inhaltsordner entsteht. Bewusst nicht
// die Konfiguration eines bestimmten Inhaltsordners: das Werkzeug kennt
// keinen — und ein Test, der an fremden Inhalten hängt, prüft das Falsche.
const BASE = JSON.parse(
  fs.readFileSync(path.join(SYS.templates, 'home', 'site.json'), 'utf8'),
);
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

test('Die mitgelieferte Vorlage ist gültig', () => {
  const config = withConfig(() => {})();
  assert.deepEqual(config.languageCodes, ['de', 'en']);
  assert.equal(config.defaultLanguage, 'de');
  assert.equal(config.formatVersion, 1);
});

test('Ohne Inhaltsordner und ohne Datei wird das gesagt', () => {
  assert.throws(() => loadConfig(), /kein Inhaltsordner/);
});

test('Die endgültige Domain wird von allem anderen unterschieden', () => {
  const at = (baseUrl) => {
    const raw = structuredClone(BASE);
    raw.baseUrl = baseUrl;
    const file = path.join(tmp, `domain-${(counter += 1)}.json`);
    fs.writeFileSync(file, JSON.stringify(raw));
    return loadConfig({ file, env: {} });
  };
  assert.equal(at('https://beispiel.test/v3/').isStaging, true);
  assert.equal(at('https://biblia.at/').isCanonical, true);
  assert.equal(at('https://www.biblia.at/').isCanonical, true);
  assert.equal(at('https://biblia.at.example.com/').isStaging, true);
});

test('Ein neueres Dateiformat verlangt ein neueres Werkzeug', () => {
  assert.throws(
    withConfig((raw) => { raw.formatVersion = 99; }),
    /neuere Fassung des Werkzeugs/,
  );
  // Fehlt die Angabe, stammt der Ordner aus der Zeit davor — das ist Fassung 1.
  assert.equal(withConfig((raw) => { delete raw.formatVersion; })().formatVersion, 1);
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
    withConfig((c) => {
      c.languages.push({ code: 'it', label: 'Italiano', htmlLang: 'it', enabled: true });
    }),
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
