/**
 * Die Schutzmassnahmen beim Hochladen.
 *
 * Das Löschen auf dem Server ist der einzige Vorgang im Projekt, der sich
 * nicht rückgängig machen lässt. Deshalb bekommt er eigene Prüfungen — auch
 * wenn sie nie eine Verbindung aufbauen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadDeployConfig, mayDelete, projectFingerprint, SENTINEL_FILE, MANIFEST_FILE } from './sftp.mjs';
import { FriendlyError } from './log.mjs';

const ENV = {
  SFTP_HOST: 'server.test',
  SFTP_USER: 'benutzer',
  SFTP_PASSWORD: 'geheim',
  SFTP_REMOTE_ROOT: '/v3/',
};

test('Das Wurzelverzeichnis wird als Ziel abgelehnt', () => {
  for (const root of ['/', '.', '//', './']) {
    assert.throws(
      () => loadDeployConfig({ env: ENV, remoteRootOverride: root }),
      FriendlyError,
      `"${root}" darf kein gültiges Ziel sein`,
    );
  }
});

test('Ein Ziel mit ".." wird abgelehnt', () => {
  assert.throws(() => loadDeployConfig({ env: ENV, remoteRootOverride: '/v3/../..' }), FriendlyError);
});

test('Ein gewöhnliches Unterverzeichnis wird normalisiert', () => {
  const config = loadDeployConfig({ env: ENV, remoteRootOverride: 'v3///unterordner/' });
  assert.equal(config.remoteRoot, '/v3/unterordner');
  assert.equal(config.host, 'server.test');
  assert.equal(config.port, 22);
});

test('Fehlende Zugangsdaten werden verständlich gemeldet', () => {
  assert.throws(() => loadDeployConfig({ env: { SFTP_HOST: 'server.test' } }), /fehlen/);
});

test('Laufzeitdaten werden nie gelöscht', () => {
  const manifest = {
    'app-data/orders/2026.json': 'x',
    'app-data/.htaccess': 'x',
    'de/index.html': 'x',
  };
  assert.equal(mayDelete('app-data/orders/2026.json', manifest), false);
  assert.equal(mayDelete('app-data/.htaccess', manifest), false);
  assert.equal(mayDelete('app-data', manifest), false);
  assert.equal(mayDelete('de/index.html', manifest), true);
});

test('Fremde Dateien werden nie gelöscht', () => {
  const manifest = { 'de/index.html': 'x' };
  assert.equal(mayDelete('fremde-anwendung/index.php', manifest), false, 'nicht von uns hochgeladen');
  assert.equal(mayDelete(SENTINEL_FILE, manifest), false);
  assert.equal(mayDelete(MANIFEST_FILE, manifest), false);
  assert.equal(mayDelete('.papierkorb-20260101/de/index.html', manifest), false);
});

test('Die Kennung hängt an Name und Basispfad', () => {
  const a = projectFingerprint({ siteName: 'Biblia', basePath: '/v3/' });
  const b = projectFingerprint({ siteName: 'Biblia', basePath: '/' });
  const c = projectFingerprint({ siteName: 'Andere', basePath: '/v3/' });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, projectFingerprint({ siteName: 'Biblia', basePath: '/v3/' }));
});
