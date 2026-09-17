/**
 * Aufbewahrungsfristen.
 *
 * Ein Eintrag, der nicht gefunden wird, wird auch nicht gelöscht. Deshalb
 * steht hier vor allem die Frage im Mittelpunkt, ob wirklich jeder Ordner
 * durchsucht wird — auch das Archiv.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { shouldRemove, listLocalRecords, listRemoteRecords } from './retention.mjs';

const record = (daysAgo, contact = {}) =>
  JSON.stringify({
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    contact,
  });

test('Ein abgelaufener Eintrag wird gelöscht', () => {
  assert.equal(shouldRemove(record(400), 365, null).remove, true);
});

test('Ein Eintrag innerhalb der Frist bleibt', () => {
  assert.equal(shouldRemove(record(10), 365, null).remove, false);
});

test('Genau an der Grenze bleibt der Eintrag', () => {
  assert.equal(shouldRemove(record(365), 365, null).remove, false);
});

test('Ein Löschersuchen greift unabhängig vom Alter', () => {
  const contents = record(1, { name: 'Maria Muster', email: 'Maria@Beispiel.at' });
  assert.equal(shouldRemove(contents, 365, 'maria@beispiel.at').remove, true);
  assert.equal(shouldRemove(contents, 365, 'maria@beispiel.at').reason, 'Löschersuchen');
  assert.equal(shouldRemove(contents, 365, 'jemand@anderes.at').remove, false);
});

test('Ein Löschersuchen sucht nur in den Kontaktdaten', () => {
  const contents = JSON.stringify({ created_at: new Date().toISOString(), items: [{ id: 101 }], contact: {} });
  assert.equal(shouldRemove(contents, 365, '101').remove, false, 'eine Flyernummer ist keine Person');
});

test('Eine beschädigte Datei wird nicht angerührt', () => {
  assert.equal(shouldRemove('kein json', 365, null).remove, false);
  assert.equal(shouldRemove('null', 365, null).remove, false);
  assert.equal(shouldRemove('{}', 365, null).remove, false);
});

test('Auch das Archiv wird lokal durchsucht', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-retention-'));
  fs.writeFileSync(path.join(dir, 'a.json'), '{}');
  fs.mkdirSync(path.join(dir, 'archiv'));
  fs.writeFileSync(path.join(dir, 'archiv', 'b.json'), '{}');
  fs.writeFileSync(path.join(dir, 'archiv', 'notiz.txt'), 'kein Datensatz');

  assert.deepEqual(listLocalRecords(dir), ['a.json', 'archiv/b.json']);
});

test('Ein fehlendes Verzeichnis ist kein Fehler', () => {
  assert.deepEqual(listLocalRecords('/gibt/es/nicht'), []);
});

/** Ein SFTP-Client, der nur eine Verzeichnisstruktur nachstellt. */
function fakeClient(tree, { unreadable = [] } = {}) {
  return {
    async list(dir) {
      if (unreadable.includes(dir)) throw new Error('Zugriff verweigert');
      if (!(dir in tree)) throw new Error('nicht vorhanden');
      return tree[dir];
    },
  };
}

test('Auch das Archiv wird auf dem Server durchsucht', async () => {
  const client = fakeClient({
    '/web/app-data/orders': [
      { name: 'a.json', type: '-' },
      { name: 'archiv', type: 'd' },
      { name: 'index.html', type: '-' },
    ],
    '/web/app-data/orders/archiv': [
      { name: 'b.json', type: '-' },
      { name: 'alt', type: 'd' },
    ],
    '/web/app-data/orders/archiv/alt': [{ name: 'c.json', type: '-' }],
  });

  const { files, unreadable } = await listRemoteRecords(client, '/web/app-data/orders');
  assert.deepEqual(files, ['a.json', 'archiv/alt/c.json', 'archiv/b.json']);
  assert.deepEqual(unreadable, []);
});

test('Ein noch leeres Verzeichnis ist kein Fehler', async () => {
  const client = fakeClient({});
  const { files, unreadable } = await listRemoteRecords(client, '/web/app-data/orders');
  assert.deepEqual(files, []);
  assert.deepEqual(unreadable, [], 'vor der ersten Bestellung gibt es den Ordner noch nicht');
});

test('Ein unlesbarer Unterordner wird gemeldet, nicht übergangen', async () => {
  const client = fakeClient(
    {
      '/web/app-data/orders': [
        { name: 'a.json', type: '-' },
        { name: 'archiv', type: 'd' },
      ],
    },
    { unreadable: ['/web/app-data/orders/archiv'] },
  );

  const { files, unreadable } = await listRemoteRecords(client, '/web/app-data/orders');
  assert.deepEqual(files, ['a.json']);
  assert.deepEqual(unreadable, ['/web/app-data/orders/archiv']);
});
