/**
 * Die Auswertung der Versionsgeschichte.
 *
 * Hier hängt die einzige Zusage dieses Projekts nach aussen dran: dass
 * /f/123/ auch in fünf Jahren noch denselben Flyer zeigt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRenames, parseHistoricIds, vanishedIds } from './history.mjs';

test('Eine Umbenennung des Kurznamens wird erkannt', () => {
  const output = 'R100\tcontent/flyers/101-zuversicht/flyer.md\tcontent/flyers/101-hoffnung/flyer.md\n';
  assert.deepEqual(parseRenames(output), [
    { oldId: 101, oldSlug: 'zuversicht', newDir: '101-hoffnung' },
  ]);
});

test('Eine geänderte Nummer wird als solche erkannt', () => {
  const output = 'R100\tcontent/flyers/101-hoffnung/flyer.md\tcontent/flyers/109-hoffnung/flyer.md\n';
  const [rename] = parseRenames(output);
  assert.equal(rename.oldId, 101);
  assert.equal(rename.newDir, '109-hoffnung');
});

test('Andere Dateien in der Ausgabe stören nicht', () => {
  const output = [
    'R090\tcontent/flyers/101-alt/flyer.de.pdf\tcontent/flyers/101-neu/flyer.de.pdf',
    'M\tcontent/flyers/102-gebet/flyer.md',
    '',
    'R100\tcontent/flyers/101-alt/flyer.md\tcontent/flyers/101-neu/flyer.md',
  ].join('\n');
  assert.deepEqual(parseRenames(output), [
    { oldId: 101, oldSlug: 'alt', newDir: '101-neu' },
  ]);
});

test('Eine leere Ausgabe ergibt nichts', () => {
  assert.deepEqual(parseRenames(''), []);
  assert.deepEqual([...parseHistoricIds('')], []);
});

test('Alle je vergebenen Nummern werden gesammelt', () => {
  const output = [
    'content/flyers/101-hoffnung/flyer.md',
    'content/flyers/101-hoffnung/flyer.de.pdf',
    'content/flyers/102-gebet/flyer.md',
    'content/flyers/199-versuch/flyer.md',
    'content/pages/home.md',
    'README.md',
  ].join('\n');
  assert.deepEqual([...parseHistoricIds(output)].sort((a, b) => a - b), [101, 102, 199]);
});

test('Eine verschwundene Nummer wird gemeldet', () => {
  const historic = new Set([101, 102, 109]);
  const current = new Map([
    [102, {}],
    [109, {}],
  ]);
  assert.deepEqual(vanishedIds(historic, current), [101]);
});

test('Eine ausdrücklich zurückgezogene Nummer wird nicht gemeldet', () => {
  const historic = new Set([101, 199]);
  const current = new Map([[101, {}]]);
  assert.deepEqual(vanishedIds(historic, current, [199]), []);
});

test('Bleibt alles wie es war, gibt es nichts zu melden', () => {
  const historic = new Set([101, 102]);
  const current = new Map([
    [101, {}],
    [102, {}],
  ]);
  assert.deepEqual(vanishedIds(historic, current), []);
});

test('Eine Umnummerierung fällt in beiden Prüfungen auf', () => {
  // 101 wurde zu 109 umbenannt: die Umbenennung wird erkannt …
  const renames = parseRenames(
    'R100\tcontent/flyers/101-hoffnung/flyer.md\tcontent/flyers/109-hoffnung/flyer.md\n',
  );
  assert.equal(renames[0].oldId, 101);

  // … und 101 gibt es heute nicht mehr.
  const historic = parseHistoricIds(
    ['content/flyers/101-hoffnung/flyer.md', 'content/flyers/109-hoffnung/flyer.md'].join('\n'),
  );
  assert.deepEqual(vanishedIds(historic, new Map([[109, {}]])), [101]);
});
