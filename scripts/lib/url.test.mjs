import test from 'node:test';
import assert from 'node:assert/strict';
import { createUrls, parseBaseUrl } from './url.mjs';

const ROUTES = {
  de: { flyer: 'flyer', read: 'lesen', topics: 'themen', page: 'seite' },
  en: { flyer: 'flyer', read: 'read', topics: 'topics', page: 'page' },
};
const SHORT = { flyer: 'f', reader: 'r' };

const sub = createUrls({ baseUrl: 'https://biblia.schaefchens.de/v3/', routes: ROUTES, shortRoutes: SHORT });
const root = createUrls({ baseUrl: 'https://biblia.at/', routes: ROUTES, shortRoutes: SHORT });

test('Basispfad wird normalisiert', () => {
  assert.equal(sub.basePath, '/v3/');
  assert.equal(root.basePath, '/');
  assert.equal(parseBaseUrl('https://x.tld/a/b').basePath, '/a/b/');
  assert.equal(parseBaseUrl('https://x.tld').basePath, '/');
});

test('Verzeichnisse bekommen einen abschliessenden Schrägstrich', () => {
  assert.equal(sub.dir('de', 'flyer', 'hoffnung'), '/v3/de/flyer/hoffnung/');
  assert.equal(root.dir('de', 'flyer', 'hoffnung'), '/de/flyer/hoffnung/');
  assert.equal(sub.dir(), '/v3/');
  assert.equal(root.dir(), '/');
});

test('Dateien bekommen keinen abschliessenden Schrägstrich', () => {
  assert.equal(sub.file('sitemap.xml'), '/v3/sitemap.xml');
  assert.equal(root.file('sitemap.xml'), '/sitemap.xml');
  assert.equal(sub.asset('app.abc123.css'), '/v3/assets/app.abc123.css');
  assert.equal(sub.media('123', 'page-01.webp'), '/v3/media/123/page-01.webp');
});

test('path() erkennt Dateien an der Endung', () => {
  assert.equal(sub.path('de', 'flyer'), '/v3/de/flyer/');
  assert.equal(sub.path('robots.txt'), '/v3/robots.txt');
});

test('Sprachabhängige Routen-Segmente werden aufgelöst', () => {
  assert.equal(sub.route('de', 'read', 'hoffnung'), '/v3/de/lesen/hoffnung/');
  assert.equal(sub.route('en', 'read', 'hope'), '/v3/en/read/hope/');
  assert.equal(sub.route('de', 'topics'), '/v3/de/themen/');
  assert.equal(sub.langHome('de'), '/v3/de/');
});

test('Permanente Kurz-URLs', () => {
  assert.equal(sub.short('flyer', 123), '/v3/f/123/');
  assert.equal(sub.short('reader', 123), '/v3/r/123/');
  assert.equal(root.short('flyer', 123), '/f/123/');
});

test('abs() liefert vollständige Adressen für canonical, QR und Sitemap', () => {
  assert.equal(sub.abs('f', '123'), 'https://biblia.schaefchens.de/v3/f/123/');
  assert.equal(sub.abs('sitemap.xml'), 'https://biblia.schaefchens.de/v3/sitemap.xml');
  assert.equal(root.abs('f', '123'), 'https://biblia.at/f/123/');
});

test('Segmente werden zerlegt und leere Werte verworfen', () => {
  assert.equal(sub.dir('de/flyer', '', null, undefined, 'hoffnung'), '/v3/de/flyer/hoffnung/');
  assert.equal(sub.dir(['de', ['flyer']]), '/v3/de/flyer/');
});

test('Gefährliche Segmente werden abgelehnt', () => {
  assert.throws(() => sub.dir('de', '..', 'etc'), /nicht erlaubt/);
  assert.throws(() => sub.dir('https://example.com/'), /vollständige Adresse/);
  assert.throws(() => sub.route('fr', 'read'), /Routen-Tabelle/);
  assert.throws(() => sub.route('de', 'unbekannt'), /Routen-Segment/);
  assert.throws(() => sub.short('nope', 1), /Kurz-Route/);
});

test('Ungültige baseUrl wird früh und verständlich gemeldet', () => {
  assert.throws(() => parseBaseUrl('biblia.at'), /keine gültige Adresse/);
  assert.throws(() => parseBaseUrl('ftp://biblia.at/'), /http:\/\/ oder https:\/\//);
  assert.throws(() => parseBaseUrl('https://biblia.at/?x=1'), /Parameter oder Anker/);
});

test('stripBase erkennt interne Adressen', () => {
  assert.equal(sub.stripBase('/v3/de/flyer/'), '/de/flyer/');
  assert.equal(sub.stripBase('https://biblia.schaefchens.de/v3/de/'), '/de/');
  assert.equal(sub.stripBase('/v3'), '/');
  assert.equal(sub.stripBase('/de/flyer/'), null, 'fehlender Basispfad ist extern');
  assert.equal(sub.stripBase('https://example.com/v3/'), null);
  assert.equal(root.stripBase('/de/flyer/'), '/de/flyer/');
  assert.equal(sub.isInternal('/v3/assets/app.css'), true);
  assert.equal(sub.isInternal('/assets/app.css'), false);
});
