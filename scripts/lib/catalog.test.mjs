/**
 * Der Bestand, gegen den der Server jede Bestellung prüft.
 *
 * Was hier fehlt, ist nicht bestellbar — und was hier zu viel steht, macht
 * einen Entwurf oder einen eingestellten Flyer bestellbar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fixture, sharedFrontmatter } from './fixtures.helper.mjs';
import { buildCatalog } from './catalog.mjs';

const flyer = (dirName, id, slug, extra = '') => ({
  dirName,
  shared: sharedFrontmatter({ id, slug, extra }),
});

test('Ein veröffentlichter Flyer steht im Bestand', () => {
  const { config, content } = fixture([flyer('101-hoffnung', 101, 'hoffnung')]);
  const catalog = buildCatalog({ config, content });
  assert.deepEqual(Object.keys(catalog), ['101']);
  assert.equal(catalog['101'].slug, 'hoffnung');
  assert.equal(catalog['101'].min, 1);
  assert.equal(catalog['101'].max, 100);
  assert.equal(catalog['101'].currency, 'EUR');
});

test('Entwürfe stehen nicht im Bestand', () => {
  const { config, content } = fixture([
    { dirName: '101-hoffnung', shared: sharedFrontmatter({}).replace('published', 'draft') },
  ]);
  assert.deepEqual(buildCatalog({ config, content }), {});
});

test('Archivierte Flyer werden nicht mehr aufgelegt und sind nicht bestellbar', () => {
  const { config, content } = fixture([
    { dirName: '101-hoffnung', shared: sharedFrontmatter({}).replace('published', 'archived') },
  ]);
  assert.deepEqual(buildCatalog({ config, content }), {});
});

test('Geplante Flyer sind noch nicht bestellbar', () => {
  const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { config, content } = fixture([flyer('101-hoffnung', 101, 'hoffnung', `publish_date: ${future}\n`)]);
  assert.deepEqual(buildCatalog({ config, content }), {});
});

test('Ein abgeschalteter Bestellweg nimmt den Flyer aus dem Bestand', () => {
  const { config, content } = fixture([
    flyer('101-hoffnung', 101, 'hoffnung', 'order:\n  enabled: false\n'),
  ]);
  assert.deepEqual(buildCatalog({ config, content }), {});
});

test('Eigene Mengenangaben werden übernommen', () => {
  const { config, content } = fixture([
    flyer('101-hoffnung', 101, 'hoffnung', 'order:\n  min_quantity: 10\n  max_quantity: 500\n'),
  ]);
  const entry = buildCatalog({ config, content })['101'];
  assert.deepEqual([entry.min, entry.max], [10, 500]);
});

test('Die Titel stehen je Sprache im Bestand — für die E-Mail an den Verein', () => {
  const { config, content } = fixture([
    {
      dirName: '101-hoffnung',
      shared: sharedFrontmatter({}),
      languages: {
        de: '---\ntitle: Hoffnung\n---\n',
        en: '---\ntitle: Hope\n---\n',
      },
    },
  ]);
  const entry = buildCatalog({ config, content })['101'];
  assert.equal(entry.titles.de, 'Hoffnung');
  assert.equal(entry.titles.en, 'Hope');
  assert.equal(entry.title, 'Hoffnung', 'ohne passende Sprache gilt die Standardsprache');
});
