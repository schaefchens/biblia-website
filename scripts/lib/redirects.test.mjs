/**
 * Frühere Adressen müssen dauerhaft funktionieren.
 *
 * slug_history allein genügt nicht — daraus muss auch eine Regel in der
 * .htaccess werden. Genau diese Verbindung wird hier geprüft.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fixture, sharedFrontmatter } from './fixtures.helper.mjs';
import { collectRedirects } from './redirects.mjs';
import { renderHtaccess } from './seo.mjs';

const withHistory = (extra) => [
  { dirName: '101-hoffnung', shared: sharedFrontmatter({ extra }) },
];

test('Aus slug_history entstehen Weiterleitungen für alle drei Adressen', () => {
  const { config, content } = fixture(withHistory('slug_history:\n  - zuversicht\n'));
  const redirects = collectRedirects({ config, content });
  const from = redirects.map((r) => r.from);

  assert.deepEqual(from, [
    '/v3/de/flyer/zuversicht/',
    '/v3/de/lesen/zuversicht/',
    '/v3/de/text/zuversicht/',
  ]);
  assert.equal(redirects[0].to, '/v3/de/flyer/hoffnung/');
});

test('Nur Sprachen, in denen es die Zieladresse gibt', () => {
  const { config, content } = fixture([
    {
      dirName: '101-hoffnung',
      shared: sharedFrontmatter({ extra: 'slug_history:\n  - zuversicht\n' }),
      languages: {
        de: '---\ntitle: Hoffnung\n---\n',
        en: '---\ntitle: Hope\n---\n',
      },
    },
  ]);
  const redirects = collectRedirects({ config, content });
  assert.ok(redirects.some((r) => r.from.startsWith('/v3/en/')), 'EN gibt es — also auch dort');

  const onlyGerman = fixture(withHistory('slug_history:\n  - zuversicht\n'));
  const german = collectRedirects({ config: onlyGerman.config, content: onlyGerman.content });
  assert.ok(!german.some((r) => r.from.startsWith('/v3/en/')), 'EN gibt es nicht — keine Weiterleitung ins Leere');
});

test('Ein Entwurf bekommt keine Weiterleitung', () => {
  const { config, content } = fixture([
    {
      dirName: '101-hoffnung',
      shared: sharedFrontmatter({ extra: 'slug_history:\n  - zuversicht\n' }).replace(
        'status: published',
        'status: draft',
      ),
    },
  ]);
  assert.deepEqual(collectRedirects({ config, content }), []);
});

test('Ein archivierter Flyer behält seine Weiterleitungen', () => {
  const { config, content } = fixture([
    {
      dirName: '101-hoffnung',
      shared: sharedFrontmatter({ extra: 'slug_history:\n  - zuversicht\n' }).replace(
        'status: published',
        'status: archived',
      ),
    },
  ]);
  assert.equal(collectRedirects({ config, content }).length, 3);
});

test('Der aktuelle slug leitet nicht auf sich selbst', () => {
  const { config, content } = fixture(withHistory('slug_history:\n  - hoffnung\n'));
  assert.deepEqual(collectRedirects({ config, content }), []);
});

test('Ohne slug_history gibt es keine Weiterleitungen', () => {
  const { config, content } = fixture(withHistory(''));
  assert.deepEqual(collectRedirects({ config, content }), []);
});

test('Die Regel in der .htaccess gilt für genau eine Adresse', () => {
  const { config, content } = fixture(withHistory('slug_history:\n  - zuversicht\n'));
  const redirects = collectRedirects({ config, content });
  const htaccess = renderHtaccess(config, { redirects, cspHashes: [] });

  assert.match(
    htaccess,
    /RedirectMatch 301 "\^\/v3\/de\/flyer\/zuversicht\/\?\$" "\/v3\/de\/flyer\/hoffnung\/"/,
  );
  assert.ok(
    !/^\s*Redirect 301 /m.test(htaccess),
    'Redirect wirkt als Präfix und würde auch Unterseiten umleiten',
  );
});

test('Ohne Weiterleitungen bleibt die .htaccess unverändert kurz', () => {
  const { config } = fixture([]);
  const htaccess = renderHtaccess(config, { redirects: [], cspHashes: [] });
  assert.ok(!htaccess.includes('RedirectMatch'));
});
