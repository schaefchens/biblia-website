import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readMarkdownFile, ContentError } from './frontmatter.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-fm-'));
let n = 0;
/** Fängt den geworfenen Fehler ein — assert.throws() gibt ihn nicht zurück. */
const caught = (fn) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("Es wurde kein Fehler geworfen.");
};

const write = (text) => {
  const file = path.join(tmp, `f${(n += 1)}.md`);
  fs.writeFileSync(file, text);
  return file;
};

test('Kopf und Inhalt werden getrennt', () => {
  const r = readMarkdownFile(write('---\ntitle: Hoffnung\ntags:\n  - a\n---\n\nText hier.\n'));
  assert.deepEqual(r.data, { title: 'Hoffnung', tags: ['a'] });
  assert.equal(r.body, 'Text hier.');
});

test('Datei ohne Kopf funktioniert', () => {
  const r = readMarkdownFile(write('Nur Text.\n'));
  assert.deepEqual(r.data, {});
  assert.equal(r.body, 'Nur Text.');
});

test('Umlaute werden zusammengesetzt normalisiert', () => {
  const decomposed = 'Über Größe';
  const r = readMarkdownFile(write(`---\ntitle: ${decomposed}\n---\n`));
  assert.equal(r.data.title, 'Über Größe');
  assert.equal(r.data.title.normalize('NFC'), r.data.title);
});

test('Doppelpunkt im Wert wird als konkreter Hinweis gemeldet', () => {
  const err = caught(() => readMarkdownFile(write('---\ntitle: Wer ist Jesus: der Weg\n---\n')));
  assert.ok(err instanceof ContentError, `erwartet ContentError, war: ${err.name}: ${err.message}`);
  assert.match(err.message, /Anführungszeichen/);
  assert.match(err.hint, /title: "Wer ist Jesus: der Weg"/);
  assert.equal(err.line, 2);
});

test('Doppelter Eintrag wird gemeldet', () => {
  const err = caught(() => readMarkdownFile(write('---\ntitle: A\ntitle: B\n---\n')));
  assert.ok(err instanceof ContentError, `erwartet ContentError, war: ${err.name}: ${err.message}`);
  assert.match(err.message, /zweimal/);
});

test('Tabulator wird gemeldet', () => {
  const err = caught(() => readMarkdownFile(write('---\na:\n\t- x\n---\n')));
  assert.ok(err instanceof ContentError, `erwartet ContentError, war: ${err.name}: ${err.message}`);
  assert.match(err.hint ?? err.message, /Tabulator|Einrückung/);
});

test('Nicht geschlossener Kopf wird gemeldet', () => {
  const err = caught(() => readMarkdownFile(write('---\ntitle: A\n\nText\n')));
  assert.ok(err instanceof ContentError, `erwartet ContentError, war: ${err.name}: ${err.message}`);
  assert.match(err.message, /nicht geschlossen/);
});

test('Windows-Zeilenenden funktionieren', () => {
  const r = readMarkdownFile(write('---\r\ntitle: A\r\n---\r\n\r\nText\r\n'));
  assert.equal(r.data.title, 'A');
  assert.equal(r.body, 'Text');
});
