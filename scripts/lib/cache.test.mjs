import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Cache, hashKey } from './cache.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-cache-'));

test('Gleicher Schlüssel, unabhängig von der Reihenfolge der Angaben', () => {
  assert.equal(hashKey({ a: 1, b: 2 }), hashKey({ b: 2, a: 1 }));
  assert.notEqual(hashKey({ a: 1 }), hashKey({ a: 2 }));
});

test('Verschachtelte Angaben gehören zum Schlüssel', () => {
  // Eine geänderte Bildqualität oder ein anderer Ausschnitt muss die
  // Bilder neu erzeugen. Bleibt der Schlüssel gleich, liefert der
  // Zwischenspeicher stillschweigend die alten Bilder weiter.
  assert.notEqual(
    hashKey({ step: 'cover', quality: { webp: 78, avif: 55 } }),
    hashKey({ step: 'cover', quality: { webp: 40, avif: 55 } }),
  );
  assert.notEqual(
    hashKey({ step: 'cover', crop: { x: 0, y: 0, width: 1, height: 1 } }),
    hashKey({ step: 'cover', crop: { x: 0.6667, y: 0, width: 0.3333, height: 1 } }),
  );
  assert.notEqual(hashKey({ a: { b: { c: 1 } } }), hashKey({ a: { b: { c: 2 } } }));
});

test('Verschachtelte Angaben sind trotzdem reihenfolgeunabhängig', () => {
  assert.equal(
    hashKey({ a: { x: 1, y: 2 }, b: [1, 2] }),
    hashKey({ b: [1, 2], a: { y: 2, x: 1 } }),
  );
});

test('Die Reihenfolge einer Liste zählt', () => {
  assert.notEqual(hashKey({ widths: [640, 960] }), hashKey({ widths: [960, 640] }));
});

test('Fehlende und leere Angaben werden unterschieden', () => {
  assert.notEqual(hashKey({ crop: null }), hashKey({ crop: {} }));
  assert.equal(hashKey({ crop: null }), hashKey({ crop: undefined }));
});

test('Zweiter Aufruf kommt aus dem Zwischenspeicher', async () => {
  const cache = new Cache(tmp());
  let runs = 0;
  const produce = async (dir) => {
    runs += 1;
    fs.writeFileSync(path.join(dir, 'bild.txt'), 'inhalt');
    return { pages: 3 };
  };

  const first = await cache.use({ pdf: 'abc' }, produce);
  const second = await cache.use({ pdf: 'abc' }, produce);

  assert.equal(runs, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(second.meta, { pages: 3 });
  assert.equal(fs.readFileSync(path.join(second.dir, 'bild.txt'), 'utf8'), 'inhalt');
});

test('Geänderter Titel erzeugt neu, obwohl das PDF gleich ist', async () => {
  const cache = new Cache(tmp());
  let runs = 0;
  const produce = async (dir) => {
    runs += 1;
    fs.writeFileSync(path.join(dir, 'teilen.webp'), 'x');
    return {};
  };
  await cache.use({ pdf: 'abc', title: 'Hoffnung' }, produce);
  await cache.use({ pdf: 'abc', title: 'Hoffnung neu' }, produce);
  assert.equal(runs, 2, 'der Titel gehört zum Schlüssel');
});

test('Fehlende Datei macht den Eintrag ungültig', async () => {
  const cache = new Cache(tmp());
  let runs = 0;
  const produce = async (dir) => {
    runs += 1;
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    return {};
  };
  const first = await cache.use({ k: 1 }, produce);
  fs.unlinkSync(path.join(first.dir, 'a.txt'));
  await cache.use({ k: 1 }, produce);
  assert.equal(runs, 2, 'ein unvollständiger Eintrag darf kein Treffer sein');
});

test('Abbruch hinterlässt keinen gültigen Eintrag', async () => {
  const cache = new Cache(tmp());
  await assert.rejects(
    cache.use({ k: 'kaputt' }, async (dir) => {
      fs.writeFileSync(path.join(dir, 'halb.txt'), 'x');
      throw new Error('abgebrochen');
    }),
  );
  let runs = 0;
  await cache.use({ k: 'kaputt' }, async (dir) => {
    runs += 1;
    fs.writeFileSync(path.join(dir, 'ganz.txt'), 'x');
    return {};
  });
  assert.equal(runs, 1);
});

test('Nicht mehr gebrauchte Einträge werden entfernt', async () => {
  const dir = tmp();
  const first = new Cache(dir);
  await first.use({ k: 'alt' }, async (d) => {
    fs.writeFileSync(path.join(d, 'a'), 'x');
    return {};
  });

  const second = new Cache(dir);
  await second.use({ k: 'neu' }, async (d) => {
    fs.writeFileSync(path.join(d, 'a'), 'x');
    return {};
  });
  assert.equal(second.collectGarbage(), 1);
});
