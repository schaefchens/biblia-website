/**
 * Der PHP-Endpunkt prüft jede Bestellung gegen den erzeugten Bestand.
 *
 * Alles, was der Browser mitschickt, ist eine Behauptung. Diese Prüfungen
 * rufen die echte PHP-Funktion auf — eine Nachbildung in JavaScript würde
 * genau die Abweichung verstecken, um die es geht.
 *
 * Ohne PHP auf dem Rechner werden sie übersprungen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SYS } from './paths.mjs';

const php = spawnSync('php', ['-v'], { encoding: 'utf8' });
const hasPhp = php.status === 0;

const CATALOG = {
  101: { slug: 'hoffnung', title: 'Hoffnung', titles: { de: 'Hoffnung', en: 'Hope' }, min: 1, max: 100, price: 0, currency: 'EUR' },
  102: { slug: 'gebet', title: 'Gebet', titles: { de: 'Gebet' }, min: 10, max: 20, price: 0, currency: 'EUR' },
};

/** Ruft biblia_parse_items() mit einem festen Bestand auf. */
function parseItems(items, { language = 'de', catalog = CATALOG } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-php-'));
  const script = path.join(dir, 'run.php');
  const validate = path.join(SYS.server, 'api', '_lib', 'validate.php');

  fs.writeFileSync(
    script,
    `<?php
require ${JSON.stringify(validate)};
$catalog = json_decode(${JSON.stringify(JSON.stringify(catalog))}, true);
$raw = ${JSON.stringify(typeof items === 'string' ? items : JSON.stringify(items))};
echo json_encode(biblia_parse_items($raw, $catalog, ${JSON.stringify(language)}));
`,
  );

  const result = spawnSync('php', [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Eine gültige Auswahl kommt unverändert an', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const out = parseItems([{ id: 101, quantity: 5 }]);
  assert.deepEqual(out.items, [{ id: 101, quantity: 5, title: 'Hoffnung' }]);
  assert.equal(out.rejected, 0);
});

test('Eine erfundene Nummer wird verworfen und gemeldet', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const out = parseItems([{ id: 999, quantity: 1 }]);
  assert.deepEqual(out.items, []);
  assert.equal(out.rejected, 1, 'die Bestellung darf nicht stillschweigend eine andere werden');
});

test('Eine Nummer, die nicht mehr bestellbar ist, wird verworfen', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const out = parseItems([{ id: 101, quantity: 1 }, { id: 103, quantity: 1 }]);
  assert.equal(out.items.length, 1);
  assert.equal(out.rejected, 1);
});

test('Die Menge wird auf die erlaubte Obergrenze begrenzt', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  assert.equal(parseItems([{ id: 101, quantity: 999 }]).items[0].quantity, 100);
  assert.equal(parseItems([{ id: 102, quantity: 999 }]).items[0].quantity, 20);
});

test('Die Menge wird auf die Untergrenze angehoben', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  assert.equal(parseItems([{ id: 102, quantity: 1 }]).items[0].quantity, 10);
});

test('Unsinnige Mengen werden abgefangen', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  // Was keine ganze Zahl ist, gilt als "eines" — nicht als "so viele wie möglich".
  assert.equal(parseItems([{ id: 101, quantity: -5 }]).items[0].quantity, 1);
  assert.equal(parseItems([{ id: 101, quantity: 'viele' }]).items[0].quantity, 1);
  assert.equal(parseItems([{ id: 101, quantity: 1e30 }]).items[0].quantity, 1);
  assert.equal(parseItems('[{"id":101,"quantity":99999999999}]').items[0].quantity, 100);
});

test('Auch viele grosse Mengen bleiben in der Obergrenze', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  // Von Hand zusammengesetzt: JSON.stringify verlöre die genaue Zahl.
  const raw = `[${Array.from({ length: 40 }, () => '{"id":101,"quantity":9223372036854775807}').join(',')}]`;
  const out = parseItems(raw);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].quantity, 100, 'die Summe darf nicht über den Zahlenbereich laufen');
});

test('Dieselbe Nummer mehrfach ergibt eine Zeile', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const out = parseItems([
    { id: 101, quantity: 3 },
    { id: 101, quantity: 4 },
  ]);
  assert.deepEqual(out.items, [{ id: 101, quantity: 7, title: 'Hoffnung' }]);
});

test('Der Titel richtet sich nach der Sprache der Anfrage', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  assert.equal(parseItems([{ id: 101, quantity: 1 }], { language: 'en' }).items[0].title, 'Hope');
  assert.equal(
    parseItems([{ id: 102, quantity: 10 }], { language: 'en' }).items[0].title,
    'Gebet',
    'ohne Übersetzung gilt der hinterlegte Titel',
  );
});

test('Unlesbare Einsendungen ergeben nichts', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  assert.deepEqual(parseItems('', {}).items, []);
  assert.deepEqual(parseItems('kein json', {}).items, []);
  assert.deepEqual(parseItems([{}], {}).items, []);
  assert.deepEqual(parseItems(['nicht mal ein objekt'], {}).items, []);
});

test('Ein leerer Bestand nimmt gar nichts an', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const out = parseItems([{ id: 101, quantity: 1 }], { catalog: {} });
  assert.deepEqual(out.items, []);
  assert.equal(out.rejected, 1);
});

test('Die Zahl der Positionen ist begrenzt', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const catalog = {};
  const items = [];
  for (let id = 1; id <= 60; id += 1) {
    catalog[id] = { slug: `f${id}`, title: `F${id}`, titles: {}, min: 1, max: 10, price: 0, currency: 'EUR' };
    items.push({ id, quantity: 1 });
  }
  const out = parseItems(items, { catalog });
  assert.equal(out.items.length, 50);
  assert.equal(out.rejected, 10);
});

test('Alle PHP-Dateien sind fehlerfrei', { skip: !hasPhp && 'PHP ist nicht installiert' }, () => {
  const apiDir = path.join(SYS.server, 'api');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.php')) files.push(full);
    }
  };
  walk(apiDir);
  assert.ok(files.length > 0);
  for (const file of files) {
    const result = spawnSync('php', ['-l', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}\n${result.stdout}${result.stderr}`);
  }
});
