/**
 * Die Freigabe für die endgültige Domain.
 *
 * Was hier durchrutscht, steht anschliessend im Impressum einer echten
 * Website — oder es gehen Bestellungen an eine Adresse, die es nicht gibt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fixture, sharedFrontmatter } from './fixtures.helper.mjs';
import { releaseBlockers, applyReleaseChecks, isDeliverableEmail } from './release.mjs';

const LEGAL = {
  imprint: '---\ntitle: Impressum\n---\n\nVerein Biblia, Beispielgasse 1, 1010 Wien.\n',
  privacy: '---\ntitle: Datenschutz\n---\n\nEs werden keine Daten an Dritte übermittelt.\n',
};

const ready = (extra = '') => ({
  flyers: [{ dirName: '101-hoffnung', shared: sharedFrontmatter({ extra }) }],
  options: { pages: LEGAL },
});

const subjects = (problems) => problems.map((p) => `${p.subject}: ${p.message}`).join('\n');

test('Vollständige Inhalte geben die Veröffentlichung frei', () => {
  const { flyers, options } = ready();
  const { config, content } = fixture(flyers, options);
  const problems = releaseBlockers({ config, content });
  assert.deepEqual(problems, [], subjects(problems));
});

test('Beispielinhalte verhindern die Veröffentlichung', () => {
  const { flyers, options } = ready('demo: true\n');
  const { config, content } = fixture(flyers, options);
  assert.match(subjects(releaseBlockers({ config, content })), /Beispielinhalte/);
});

test('Ein Beispieltext auf einer Seite fällt auf', () => {
  const { flyers } = ready();
  const { config, content } = fixture(flyers, {
    pages: { ...LEGAL, imprint: '---\ndemo: true\ntitle: Impressum\n---\n\nEchter Text.\n' },
  });
  assert.match(subjects(releaseBlockers({ config, content })), /Beispieltexte/);
});

test('Platzhalter im Impressum fallen auf, auch ohne demo-Kennzeichen', () => {
  const { flyers } = ready();
  const { config, content } = fixture(flyers, {
    pages: {
      ...LEGAL,
      imprint: '---\ntitle: Impressum\n---\n\nBiblia\nStraße und Hausnummer\n',
    },
  });
  assert.match(subjects(releaseBlockers({ config, content })), /Platzhalter/);
});

test('Ein fehlendes Impressum verhindert die Veröffentlichung', () => {
  const { flyers } = ready();
  const { config, content } = fixture(flyers, { pages: { privacy: LEGAL.privacy } });
  assert.match(subjects(releaseBlockers({ config, content })), /Seite imprint/);
});

test('Unzustellbare Empfängeradressen verhindern die Veröffentlichung', () => {
  const { flyers, options } = ready();
  const { config, content } = fixture(flyers, {
    ...options,
    site: { order: { enabled: true, defaultCurrency: 'EUR', defaultMaxQuantity: 100, recipientEmail: 'bestellung@example.invalid', senderEmail: 'website@example.invalid' } },
  });
  const problems = releaseBlockers({ config, content });
  assert.match(subjects(problems), /order\.recipientEmail/);
  assert.match(subjects(problems), /order\.senderEmail/);
});

test('Ohne einen einzigen veröffentlichten Flyer gibt es nichts zu veröffentlichen', () => {
  const { config, content } = fixture(
    [
      {
        dirName: '101-hoffnung',
        shared: sharedFrontmatter({}).replace('status: published', 'status: draft'),
      },
    ],
    { pages: LEGAL },
  );
  assert.match(subjects(releaseBlockers({ config, content })), /kein einziger Flyer/);
});

test('Auf der Testadresse sind dieselben Punkte nur Hinweise', () => {
  const { flyers, options } = ready('demo: true\n');
  const { config, content } = fixture(flyers, {
    ...options,
    site: { canonicalDomain: 'eine-andere-domain.test' },
  });
  assert.equal(config.isStaging, true);
  const { level } = applyReleaseChecks({ config, content });
  assert.equal(level, 'warning');
  assert.equal(content.issues.hasErrors, false, 'auf der Testadresse darf nichts blockieren');
  assert.ok(content.issues.warnings.length > 0);
});

test('Unter der endgültigen Domain werden daraus Fehler', () => {
  const { flyers, options } = ready('demo: true\n');
  const { config, content } = fixture(flyers, options);
  assert.equal(config.isStaging, false);
  const { level } = applyReleaseChecks({ config, content });
  assert.equal(level, 'error');
  assert.equal(content.issues.hasErrors, true);
});

test('Reservierte Adressen gelten nie als zustellbar', () => {
  for (const address of [
    'kontakt@example.invalid',
    'kontakt@example.com',
    'kontakt@localhost',
    'kontakt@irgendwas.test',
    'ohne-klammeraffe',
    '',
  ]) {
    assert.equal(isDeliverableEmail(address), false, address);
  }
  assert.equal(isDeliverableEmail('kontakt@biblia.at'), true);
});
