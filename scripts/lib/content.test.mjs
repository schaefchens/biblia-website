import test from 'node:test';
import assert from 'node:assert/strict';

import { fixture, sharedFrontmatter, messagesOf as messages } from './fixtures.helper.mjs';
import { isScheduled, isListed, isReachable, isPublic } from './content.mjs';

const shared = (extra = '') => sharedFrontmatter({ extra });
const basic = (extra = '') => [{ dirName: '101-hoffnung', shared: shared(extra) }];

test('Ein veröffentlichter Flyer wird gelistet und ist erreichbar', () => {
  const { content } = fixture(basic());
  const flyer = content.flyersById.get(101);
  assert.equal(content.issues.hasErrors, false, messages(content));
  assert.equal(isListed(flyer, 'de'), true);
  assert.equal(isReachable(flyer, 'de'), true);
  assert.equal(isPublic(flyer), true);
  assert.equal(content.published('de').length, 1);
});

test('Ein Entwurf hat nirgends eine Adresse', () => {
  const { content } = fixture([{ dirName: '101-hoffnung', shared: shared().replace('published', 'draft') }]);
  const flyer = content.flyersById.get(101);
  assert.equal(isListed(flyer, 'de'), false);
  assert.equal(isReachable(flyer, 'de'), false);
  assert.equal(isPublic(flyer), false, 'auch nicht unter der Kurzadresse /f/101/');
});

test('Ein archivierter Flyer bleibt erreichbar, wird aber nicht gelistet', () => {
  const { content } = fixture([{ dirName: '101-hoffnung', shared: shared().replace('published', 'archived') }]);
  const flyer = content.flyersById.get(101);
  assert.equal(isListed(flyer, 'de'), false);
  assert.equal(isReachable(flyer, 'de'), true, 'gedruckte QR-Codes müssen weiter funktionieren');
  assert.equal(isPublic(flyer), true);
});

test('Ein geplanter Flyer erscheint nirgends — auch nicht unter der Kurzadresse', () => {
  const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { content } = fixture(basic(`publish_date: ${future}\n`));
  const flyer = content.flyersById.get(101);
  assert.equal(isScheduled(flyer), true);
  assert.equal(isListed(flyer, 'de'), false);
  assert.equal(isReachable(flyer, 'de'), false);
  assert.equal(
    isPublic(flyer),
    false,
    'sonst wäre /f/101/ die Hintertür an der Planung vorbei',
  );
});

test('Ein vergangenes Veröffentlichungsdatum hält nichts zurück', () => {
  const { content } = fixture(basic('publish_date: 2020-01-01\n'));
  assert.equal(isListed(content.flyersById.get(101), 'de'), true);
});

test('Ein unmögliches Datum ist ein Fehler, kein übernommener Text', () => {
  const { content } = fixture(basic('date: 2026-02-30\n'));
  assert.equal(content.issues.hasErrors, true);
  assert.match(messages(content), /kein gültiges Datum/);
  assert.equal(content.flyersById.get(101).date, null);
});

test('Ein Datum in falscher Schreibweise wird gemeldet', () => {
  const { content } = fixture(basic('date: "14.08.2026"\n'));
  assert.match(messages(content), /kein gültiges Datum/);
});

test('Ein gültiges Datum bleibt unverändert', () => {
  const { content } = fixture(basic('date: 2026-08-14\n'));
  assert.equal(content.issues.hasErrors, false, messages(content));
  assert.equal(content.flyersById.get(101).date, '2026-08-14');
});

test('Mengenangaben werden geprüft und aufeinander abgestimmt', () => {
  const { content } = fixture(basic('order:\n  min_quantity: 50\n  max_quantity: 10\n'));
  assert.match(messages(content), /ist größer als/);
  const order = content.flyersById.get(101).order;
  assert.ok(order.minQuantity <= order.maxQuantity, 'die Grenzen dürfen sich nie überkreuzen');
});

test('Eine unsinnige Menge wird abgelehnt', () => {
  const { content } = fixture(basic('order:\n  max_quantity: 100000\n'));
  assert.match(messages(content), /Ungültige Angabe "order.max_quantity"/);
  assert.equal(content.flyersById.get(101).order.maxQuantity, 100, 'es gilt der Vorgabewert');
});

test('Ohne Angabe gelten die Vorgaben aus der Konfiguration', () => {
  const { content } = fixture(basic());
  const order = content.flyersById.get(101).order;
  assert.deepEqual([order.minQuantity, order.maxQuantity], [1, 100]);
});

test('Eine ungültige Währung wird gemeldet', () => {
  const { content } = fixture(basic('order:\n  currency: Euro\n'));
  assert.match(messages(content), /Ungültige Währung/);
  assert.equal(content.flyersById.get(101).order.currency, 'EUR');
});

test('Beispielinhalte sind als solche erkennbar', () => {
  const { content } = fixture(basic('demo: true\n'));
  assert.equal(content.flyersById.get(101).demo, true);
});

test('Eine Textfassung von Hand wird eingelesen', () => {
  const { content } = fixture([
    { dirName: '101-hoffnung', shared: shared(), texts: { de: 'Erster Absatz.\n\nZweiter Absatz.' } },
  ]);
  assert.equal(
    content.flyersById.get(101).languages.de.textOverride,
    'Erster Absatz.\n\nZweiter Absatz.',
  );
});

test('Eine leere Textfassung wird gemeldet und nicht verwendet', () => {
  const { content } = fixture([
    { dirName: '101-hoffnung', shared: shared(), texts: { de: '   \n' } },
  ]);
  assert.match(messages(content), /ist leer/);
  assert.equal(content.flyersById.get(101).languages.de.textOverride, null);
});

test('Fehlt das PDF einer Sprache, wird das der Standardsprache benutzt', () => {
  const { content } = fixture([
    {
      dirName: '101-hoffnung',
      shared: shared(),
      languages: { de: '---\ntitle: Hoffnung\n---\n', en: '---\ntitle: Hope\n---\n' },
      pdfs: ['de'],
    },
  ]);
  const flyer = content.flyersById.get(101);
  assert.equal(flyer.languages.en.hasOwnPdf, false);
  assert.equal(flyer.languages.en.pdfLanguage, 'de');
  assert.equal(flyer.languages.de.hasOwnPdf, true);
});
