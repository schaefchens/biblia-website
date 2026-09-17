/**
 * Der Suchindex.
 *
 * Er wird bei jedem Besuch des Archivs geladen. Zwei Dinge zählen: er darf
 * nichts enthalten, was auf der Seite nicht sichtbar ist, und er darf nicht
 * unbemerkt wachsen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fixture, sharedFrontmatter } from './fixtures.helper.mjs';
import { loadI18n } from './i18n.mjs';
import { createContext } from './render-context.mjs';
import { buildSearchIndex, assertIndexBudget, FIELDS } from './search-index.mjs';

const flyer = (id, slug, extra = '', languages) => ({
  dirName: `${id}-${slug}`,
  shared: sharedFrontmatter({ id, slug, extra }),
  ...(languages ? { languages } : {}),
});

function index(flyers, lang = 'de') {
  const { config, content } = fixture(flyers);
  const i18n = loadI18n(config);
  const ctx = createContext({ config, content, i18n, assets: { css: '', js: '' } });
  return { data: buildSearchIndex({ config, content, ctx, lang }), content };
}

const ids = (data) => data.entries.map((entry) => entry[FIELDS.indexOf('id')]);

test('Nur veröffentlichte Flyer stehen im Index', () => {
  const { data } = index([
    flyer(101, 'eins'),
    { ...flyer(102, 'zwei'), shared: sharedFrontmatter({ id: 102, slug: 'zwei' }).replace('published', 'draft') },
    { ...flyer(103, 'drei'), shared: sharedFrontmatter({ id: 103, slug: 'drei' }).replace('published', 'archived') },
  ]);
  assert.deepEqual(ids(data), [101]);
});

test('Ein geplanter Flyer steht noch nicht im Index', () => {
  const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { data } = index([flyer(101, 'eins'), flyer(102, 'zwei', `publish_date: ${future}\n`)]);
  assert.deepEqual(ids(data), [101]);
});

test('Nur Flyer, die es in dieser Sprache gibt', () => {
  const { data } = index(
    [
      flyer(101, 'eins', '', { de: '---\ntitle: Eins\n---\n', en: '---\ntitle: One\n---\n' }),
      flyer(102, 'zwei', '', { de: '---\ntitle: Zwei\n---\n' }),
    ],
    'en',
  );
  assert.deepEqual(ids(data), [101]);
});

test('Der Volltext aus den PDF-Dateien steht bewusst nicht im Index', () => {
  const { data } = index([
    flyer(101, 'eins', '', { de: '---\ntitle: Eins\ndescription: Kurze Beschreibung.\n---\n\nEin langer Fliesstext.\n' }),
  ]);
  const text = data.entries[0][FIELDS.indexOf('text')];
  assert.match(text, /Kurze Beschreibung/);
  assert.ok(!text.includes('langer Fliesstext'), 'sonst wüchse der Index unbegrenzt');
});

test('Themen und Kategorien stehen nur drin, wenn sie auch benutzt werden', () => {
  const { data } = index([flyer(101, 'eins', 'topics:\n  - hoffnung\n')]);
  assert.deepEqual(data.topics, [['hoffnung', 'hoffnung']]);
  assert.deepEqual(data.categories, [['leben', 'leben']]);

  const { data: leer } = index([]);
  assert.deepEqual(leer.topics, []);
  assert.deepEqual(leer.categories, []);
});

test('Die Feldreihenfolge ist Teil des Vertrags mit dem Browser', () => {
  const { data } = index([flyer(101, 'eins')]);
  assert.deepEqual(data.fields, FIELDS);
  assert.equal(data.entries[0].length, FIELDS.length);
});

test('Ein zu grosser Index bricht den Build ab', () => {
  const small = JSON.stringify({ entries: [] });
  assert.ok(assertIndexBudget(small, 150 * 1024, 'de') > 0);

  const huge = JSON.stringify({ entries: Array.from({ length: 20000 }, (_, i) => [i, `eintrag-${i}`]) });
  assert.throws(() => assertIndexBudget(huge, 1024, 'de'));
});
