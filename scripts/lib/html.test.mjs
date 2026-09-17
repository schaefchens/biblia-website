import test from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, render, attrs, classNames, escapeHtml, jsonScript } from './html.mjs';

test('Werte werden automatisch maskiert', () => {
  assert.equal(render(html`<p>${'<script>alert(1)</script>'}</p>`), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('raw() ist der einzige Weg an der Maskierung vorbei', () => {
  assert.equal(render(html`<i>${raw('<b>ok</b>')}</i>`), '<i><b>ok</b></i>');
  assert.equal(render(raw(null)), '');
});

test('Verschachtelte Templates bleiben unmaskiert', () => {
  const inner = html`<b>${'A&B'}</b>`;
  assert.equal(render(html`<p>${inner}</p>`), '<p><b>A&amp;B</b></p>');
});

test('Listen werden zusammengefügt, leere Werte verworfen', () => {
  assert.equal(render(html`${['a', '&', 'b']}`), 'a&amp;b');
  assert.equal(render(html`${null}${undefined}${false}${true}`), '');
  assert.equal(render(html`${0}`), '0');
});

test('attrs() lässt leere Attribute weg und maskiert Werte', () => {
  assert.equal(render(attrs({ href: '/v3/de/', class: null, hidden: true, 'data-x': false })), ' href="/v3/de/" hidden');
  assert.equal(render(attrs({ title: 'a"b' })), ' title="a&quot;b"');
  assert.equal(render(attrs({})), '');
  assert.throws(() => attrs({ 'a b': 'x' }), /Ungültiger Attributname/);
});

test('classNames verwirft falsche Werte', () => {
  assert.equal(classNames('card', false, null, ['is-featured']), 'card is-featured');
  assert.equal(classNames(false, null), null);
});

test('jsonScript kann das script-Element nicht vorzeitig beenden', () => {
  assert.equal(render(jsonScript({ t: '</script>' })), '{"t":"\\u003c/script>"}');
  assert.ok(!render(jsonScript({ t: '</script>' })).includes('</script>'));
  assert.equal(render(jsonScript({ u: '\u2028' })), '{"u":"\\u2028"}');
});
