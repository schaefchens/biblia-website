import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, maskSecret } from './env.mjs';

test('parseEnv liest Schlüssel, Kommentare und Anführungszeichen', () => {
  const env = parseEnv(
    ['# Kommentar', 'A=1', '', 'B = zwei ', 'C="mit Leerzeichen"', "D='hoch'", 'KAPUTT', 'E=a=b'].join('\n'),
  );
  assert.deepEqual(env, { A: '1', B: 'zwei', C: 'mit Leerzeichen', D: 'hoch', E: 'a=b' });
});

test('parseEnv kommt mit Windows-Zeilenenden zurecht', () => {
  assert.deepEqual(parseEnv('A=1\r\nB=2\r\n'), { A: '1', B: '2' });
});

test('maskSecret zeigt niemals das ganze Passwort', () => {
  assert.equal(maskSecret(''), '(leer)');
  assert.equal(maskSecret('abcd'), '****');
  assert.ok(!maskSecret('supergeheim123').includes('geheim'));
});
