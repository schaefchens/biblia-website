/**
 * Die Medien-Pipeline mit echten PDF-Dateien.
 *
 * Diese Prüfungen zeichnen wirklich PDF-Seiten und schreiben wirklich
 * Bilder. Sie sind damit die langsamsten im Projekt — aber die Fehler, um
 * die es hier geht, zeigen sich erst im Zusammenspiel: ein Titelbild, das
 * die falsche Seite nimmt, und zwei Sprachen, die sich dieselbe Druckdatei
 * teilen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PDFDocument, rgb } from 'pdf-lib';
import { fixture, sharedFrontmatter } from './fixtures.helper.mjs';
import { loadI18n } from './i18n.mjs';
import { buildMedia } from './media.mjs';
import { Emitter } from './emit.mjs';
import { createDemoPdf } from './demo-pdf.mjs';

/** Ein PDF, das nur aus Flächen besteht — daraus lässt sich kein Text lesen. */
async function createImageOnlyPdf(pageCount = 2) {
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  for (let index = 0; index < pageCount; index += 1) {
    const page = doc.addPage([300, 420]);
    page.drawRectangle({
      x: 20,
      y: 20 + index * 40,
      width: 260,
      height: 200,
      color: rgb(0.2 + index * 0.3, 0.4, 0.6),
    });
  }
  return doc.save();
}

/** Baut die Medien eines Fixture-Verzeichnisses in einen temporären Ordner. */
async function build(flyers, { pdfs = {} } = {}) {
  const result = fixture(flyers);
  const { config, content, dirs } = result;

  // Die Platzhalter-PDFs des Fixtures durch echte Dateien ersetzen.
  for (const [relative, bytes] of Object.entries(pdfs)) {
    fs.writeFileSync(path.join(dirs.flyers, relative), await bytes);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-media-'));
  const emitter = new Emitter(path.join(work, 'dist'));
  const media = await buildMedia({
    config,
    content,
    i18n: loadI18n(config),
    emitter,
    cacheDir: path.join(work, 'cache'),
    printDir: path.join(work, 'print'),
  });
  return { config, content, media, emitter, work };
}

const flyerSpec = (extra = '') => ({
  dirName: '901-probe',
  shared: sharedFrontmatter({ id: 901, slug: 'probe', extra }),
});

test('Aus einem PDF entstehen Seiten, Titelbild und Bilder zum Teilen', async () => {
  const pdf = createDemoPdf({ title: 'Probe', body: 'Ein Text.', pages: 3 });
  const { content, media, emitter } = await build([flyerSpec()], { pdfs: { '901-probe/flyer.de.pdf': pdf } });
  const flyer = content.flyersById.get(901);

  assert.deepEqual(media.issues, []);
  assert.equal(media.pageCount(flyer, 'de'), 3);
  assert.ok(media.cover(flyer, 'de'), 'ein Titelbild');
  assert.ok(media.shareImage(flyer, 'de'), 'ein Bild zum Teilen');
  assert.ok(media.statusImage(flyer, 'de'), 'ein Bild im Hochformat');
  assert.ok(media.qrUrl(flyer, 'de'), 'ein QR-Code');
  assert.ok(emitter.paths().some((p) => p.startsWith('media/901/de/page-01-')));
  assert.ok(emitter.paths().some((p) => p.startsWith('media/901/de/cover-')));
});

test('Ein Titelbild von Seite 3 zeigt wirklich Seite 3', async () => {
  const pdf = () => createDemoPdf({ title: 'Probe', body: 'Ein Text.', pages: 4 });

  const first = await build([flyerSpec()], { pdfs: { '901-probe/flyer.de.pdf': pdf() } });
  const third = await build([flyerSpec('cover:\n  page: 3\n')], { pdfs: { '901-probe/flyer.de.pdf': pdf() } });

  const read = (run) => {
    const flyer = run.content.flyersById.get(901);
    const cover = run.media.cover(flyer, 'de');
    const file = run.emitter.files.get(cover.src.replace(/^\/v3\//, ''));
    return fs.readFileSync(file.from);
  };

  assert.ok(!read(first).equals(read(third)), 'sonst wäre cover.page wirkungslos');
});

test('Ein Ausschnitt verändert das Titelbild', async () => {
  const pdf = () => createDemoPdf({ title: 'Probe', body: 'Ein Text.', pages: 2 });

  const whole = await build([flyerSpec()], { pdfs: { '901-probe/flyer.de.pdf': pdf() } });
  const right = await build(
    [flyerSpec('cover:\n  crop: { x: 0.6667, y: 0, width: 0.3333, height: 1 }\n')],
    { pdfs: { '901-probe/flyer.de.pdf': pdf() } },
  );

  const read = (run) => {
    const flyer = run.content.flyersById.get(901);
    const cover = run.media.cover(flyer, 'de');
    return fs.readFileSync(run.emitter.files.get(cover.src.replace(/^\/v3\//, '')).from);
  };

  assert.ok(!read(whole).equals(read(right)), 'der Zwischenspeicher darf den Ausschnitt nicht übersehen');
});

test('Eine geliehene Druckdatei bricht den Build nicht ab', async () => {
  const pdf = createDemoPdf({ title: 'Probe', body: 'Ein Text.', pages: 2 });
  const spec = {
    dirName: '901-probe',
    shared: sharedFrontmatter({ id: 901, slug: 'probe' }),
    languages: {
      de: '---\ntitle: Probe\n---\n',
      en: '---\ntitle: Sample\n---\n',
    },
    pdfs: ['de'],
  };

  const { content, media, emitter } = await build([spec], { pdfs: { '901-probe/flyer.de.pdf': pdf } });
  const flyer = content.flyersById.get(901);

  assert.deepEqual(media.issues, []);
  assert.equal(media.pageCount(flyer, 'en'), 2, 'die englische Fassung zeigt dieselben Seiten');
  assert.ok(media.cover(flyer, 'en'), 'und dasselbe Titelbild');

  // Seiten und Titelbild liegen genau einmal, unter der Sprache der Druckdatei.
  assert.ok(emitter.paths().some((p) => p.startsWith('media/901/de/page-01-')));
  assert.ok(!emitter.paths().some((p) => p.startsWith('media/901/en/page-01-')));

  // Die Bilder zum Teilen entstehen je Sprache neu — sie tragen den Titel.
  const share = (lang) => media.shareImage(flyer, lang).url;
  assert.notEqual(share('de'), share('en'));
});

test('Ein PDF ohne auslesbaren Text wird gemeldet', async () => {
  const { media } = await build([flyerSpec()], { pdfs: { '901-probe/flyer.de.pdf': createImageOnlyPdf(2) } });

  assert.equal(media.issues.length, 1);
  assert.equal(media.issues[0].level, 'warning');
  assert.match(media.issues[0].message, /kein Text auslesen/);
});

test('Eine Textfassung von Hand macht die Warnung überflüssig', async () => {
  const spec = { ...flyerSpec(), texts: { de: 'Der Text dieses Flyers.' } };
  const { content, media } = await build([spec], { pdfs: { '901-probe/flyer.de.pdf': createImageOnlyPdf(2) } });

  assert.deepEqual(media.issues, []);
  assert.equal(media.manualText(content.flyersById.get(901), 'de'), 'Der Text dieses Flyers.');
});

test('Ein cover.page hinter der letzten Seite wird gemeldet', async () => {
  const pdf = createDemoPdf({ title: 'Probe', body: 'Ein Text.', pages: 2 });
  const { media } = await build([flyerSpec('cover:\n  page: 9\n')], {
    pdfs: { '901-probe/flyer.de.pdf': pdf },
  });

  assert.equal(media.issues.length, 1);
  assert.equal(media.issues[0].level, 'warning');
  assert.match(media.issues[0].message, /cover\.page ist 9/);
});

test('Eine unlesbare Druckdatei ist ein Fehler, kein leerer Lesemodus', async () => {
  const { media } = await build([flyerSpec()], {
    pdfs: { '901-probe/flyer.de.pdf': Buffer.from('das ist kein PDF') },
  });

  assert.equal(media.issues.length, 1);
  assert.equal(media.issues[0].level, 'error');
});
