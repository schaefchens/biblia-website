/**
 * npm run retention
 *
 * Löscht abgelaufene Bestell- und Kontaktdaten — lokal und auf dem Server.
 *
 * Personenbezogene Daten dürfen nicht unbegrenzt aufbewahrt werden. Die
 * Fristen stehen in config/site.json unter "retention".
 *
 * Zwei Dinge sind hier wichtiger als überall sonst:
 *
 *   1. Es wird jeder Ordner durchsucht, auch das Archiv, in das
 *      "npm run fetch -- --archive" die Einträge verschiebt. Ein Eintrag,
 *      den niemand mehr sieht, ist trotzdem gespeichert.
 *   2. Ein fehlgeschlagenes Löschen wird gemeldet und führt zu einem
 *      Fehler. Ein Löschersuchen nach Art. 17 DSGVO, das stillschweigend
 *      nicht ausgeführt wurde, wäre der schlimmste denkbare Ausgang.
 *
 *   --dry-run          Nur anzeigen
 *   --local-only       Nur die lokale Kopie
 *   --person <text>    Zusätzlich alle Einträge löschen, die diesen Text
 *                      enthalten (Name oder E-Mail) — für Löschersuchen
 *                      nach Art. 17 DSGVO
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadDeployConfig, connect } from './lib/sftp.mjs';
import { shouldRemove, listLocalRecords, listRemoteRecords } from './lib/retention.mjs';
import { blank, color, heading, info, ok, plural, runMain, step, warn, error, fail } from './lib/log.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const localOnly = args.includes('--local-only');
const personIndex = args.indexOf('--person');
const person = personIndex >= 0 ? args[personIndex + 1] : null;

if (personIndex >= 0 && !person) {
  fail('Nach --person fehlt der Suchbegriff.', 'Beispiel:  npm run retention -- --person "maria@example.org"');
}

runMain(async () => {
  const config = loadConfig();
  const kinds = [
    { dir: 'orders', label: 'Bestellanfragen', days: config.retention?.orderDays ?? 365 },
    { dir: 'contact', label: 'Kontaktnachrichten', days: config.retention?.contactDays ?? 180 },
  ];

  heading('Biblia — Aufbewahrungsfristen anwenden');
  for (const kind of kinds) {
    info(color.gray(`    ${kind.label}: ${kind.days} Tage`));
  }
  if (person) warn(`Zusätzlich: alle Einträge zu "${person}" werden gelöscht.`);
  if (dryRun) warn('Probelauf — es wird nichts gelöscht.');
  blank();

  /** Was nicht gelöscht werden konnte. Wird am Ende zum Fehler. */
  const failures = [];

  // --- Lokal ---
  let removedLocal = 0;
  for (const kind of kinds) {
    const dir = path.join(DIR.appData, kind.dir);
    const files = listLocalRecords(dir);
    if (files.length === 0) continue;

    step(`${kind.label} lokal: ${plural(files.length, 'Eintrag', 'Einträge')}`);
    for (const name of files) {
      const file = path.join(dir, name);
      const outcome = shouldRemove(fs.readFileSync(file, 'utf8'), kind.days, person);
      if (!outcome.remove) continue;
      info(color.gray(`    ${dryRun ? 'würde löschen' : 'gelöscht'}: ${rel(file)} (${outcome.reason})`));
      if (!dryRun) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          failures.push(`lokal ${rel(file)}: ${err.message}`);
          continue;
        }
      }
      removedLocal += 1;
    }
  }
  if (removedLocal === 0) ok('Lokal ist nichts abgelaufen.');

  // --- Auf dem Server ---
  let removedRemote = 0;
  if (!localOnly) {
    const deploy = loadDeployConfig();
    const client = await connect(deploy);
    try {
      for (const kind of kinds) {
        const remoteDir = `${deploy.remoteRoot}/app-data/${kind.dir}`;
        const { files, unreadable } = await listRemoteRecords(client, remoteDir);
        for (const dir of unreadable) {
          failures.push(`Verzeichnis nicht lesbar: ${dir}`);
        }
        if (files.length === 0) continue;

        step(`${kind.label} auf dem Server: ${plural(files.length, 'Eintrag', 'Einträge')}`);
        for (const name of files) {
          const remoteFile = `${remoteDir}/${name}`;
          let outcome;
          try {
            const buffer = await client.get(remoteFile);
            outcome = shouldRemove(buffer.toString('utf8'), kind.days, person);
          } catch (err) {
            failures.push(`nicht lesbar: ${remoteFile} (${err.message})`);
            continue;
          }
          if (!outcome.remove) continue;

          info(color.gray(`    ${dryRun ? 'würde löschen' : 'gelöscht'}: ${name} (${outcome.reason})`));
          if (!dryRun) {
            try {
              await client.delete(remoteFile, true);
            } catch (err) {
              failures.push(`nicht gelöscht: ${remoteFile} (${err.message})`);
              continue;
            }
          }
          removedRemote += 1;
        }
      }
    } finally {
      await client.end().catch(() => {});
    }
    if (removedRemote === 0 && failures.length === 0) ok('Auf dem Server ist nichts abgelaufen.');
  }

  blank();
  const total = removedLocal + removedRemote;
  if (total === 0 && failures.length === 0) ok('Nichts zu tun.');
  else if (total > 0) ok(`${plural(total, 'Eintrag', 'Einträge')} ${dryRun ? 'wären betroffen' : 'gelöscht'}.`);

  if (failures.length > 0) {
    blank();
    error(plural(failures.length, 'Eintrag konnte nicht gelöscht werden', 'Einträge konnten nicht gelöscht werden'));
    for (const failure of failures) info(color.gray(`    ${failure}`));
    blank();
    info('Personenbezogene Daten sind damit weiterhin gespeichert.');
    info('Bitte den Vorgang wiederholen:  npm run retention');
    if (person) info(`Es ging um ein Löschersuchen zu "${person}" — das muss nachweislich erledigt werden.`);
    blank();
    return 1;
  }

  blank();
  return 0;
});
