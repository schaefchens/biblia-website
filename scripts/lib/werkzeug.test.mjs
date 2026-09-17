/**
 * Der Stand des Werkzeugs.
 *
 * Ein Submodul, das leer geblieben oder stehengeblieben ist, sieht man dem
 * Ordner nicht an — und die Website entsteht dann mit einer anderen Fassung
 * als vorgesehen. Deshalb wird das erste Zeichen jeder Zeile von
 * "git submodule status" genau ausgewertet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSubmoduleStatus, describeSubmoduleState } from './werkzeug.mjs';

test('Ein Leerzeichen heisst: auf dem festgehaltenen Stand', () => {
  const status = parseSubmoduleStatus(' a1b2c3d4e5f6 werkzeug (v2)\n');
  assert.equal(status.state, 'ok');
  assert.equal(status.sha, 'a1b2c3d4e5f6');
  assert.equal(status.path, 'werkzeug');
  assert.equal(status.describe, 'v2');
});

test('Ein Minus heisst: gar nicht eingerichtet', () => {
  const status = parseSubmoduleStatus('-a1b2c3d4e5f6 werkzeug\n');
  assert.equal(status.state, 'missing');
  assert.equal(status.describe, null, 'ohne Arbeitskopie gibt es keine Beschreibung');
});

test('Ein Plus heisst: auf einem anderen Stand', () => {
  const status = parseSubmoduleStatus('+9f8e7d6c5b4a werkzeug (v2-3-gabc1234)\n');
  assert.equal(status.state, 'moved');
  assert.equal(status.describe, 'v2-3-gabc1234');
});

test('Ein U heisst: ungelöster Konflikt', () => {
  assert.equal(parseSubmoduleStatus('U0000000000 werkzeug\n').state, 'conflict');
});

test('Eine beschnittene Zeile gilt trotzdem als eingerichtet', () => {
  // Ein Aufrufer, der die Ausgabe beschneidet, verlöre sonst genau die
  // Aussage "alles in Ordnung" — und würde grundlos warnen.
  const status = parseSubmoduleStatus('e9abf295a1973c80 werkzeug (v1.0.0-2-ge9abf29)');
  assert.equal(status.state, 'ok');
  assert.equal(status.sha, 'e9abf295a1973c80');
  assert.equal(status.path, 'werkzeug');
  assert.equal(status.describe, 'v1.0.0-2-ge9abf29');
});

test('Keine Ausgabe heisst: es lässt sich nichts sagen', () => {
  for (const value of ['', '   \n', null, undefined]) {
    assert.equal(parseSubmoduleStatus(value).state, 'unknown');
  }
});

test('Nur eingerichtet gilt als in Ordnung', () => {
  const ok = describeSubmoduleState(parseSubmoduleStatus(' abc werkzeug (v2)'));
  assert.equal(ok.level, 'ok');

  for (const line of ['-abc werkzeug', '+abc werkzeug (v3)', 'Uabc werkzeug']) {
    const described = describeSubmoduleState(parseSubmoduleStatus(line));
    assert.equal(described.level, 'problem', line);
    assert.ok(described.hint, `${line}: ohne Hinweis weiss niemand, was zu tun ist`);
  }
});

test('Der Hinweis nennt den Befehl, der hilft', () => {
  const missing = describeSubmoduleState(parseSubmoduleStatus('-abc werkzeug'));
  assert.match(missing.hint, /git submodule update --init/);
  assert.match(missing.hint, /npm ci/);

  const moved = describeSubmoduleState(parseSubmoduleStatus('+abc werkzeug (v3)'));
  assert.match(moved.hint, /git submodule update/);
});

test('Der Name des Ordners lässt sich ändern', () => {
  const described = describeSubmoduleState(parseSubmoduleStatus('-abc programm'), { dir: 'programm' });
  assert.match(described.message, /programm\//);
});
