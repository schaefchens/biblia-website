/**
 * npm run retention
 *
 * Löscht abgelaufene Bestell- und Kontaktdaten — lokal und auf dem Server.
 *
 * Personenbezogene Daten dürfen nicht unbegrenzt aufbewahrt werden. Die
 * Fristen stehen in config/site.json unter "retention".
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
import { blank, color, heading, info, ok, plural, runMain, step, warn, fail } from './lib/log.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const localOnly = args.includes('--local-only');
const personIndex = args.indexOf('--person');
const person = personIndex >= 0 ? args[personIndex + 1] : null;

if (personIndex >= 0 && !person) {
  fail('Nach --person fehlt der Suchbegriff.', 'Beispiel:  npm run retention -- --person "maria@example.org"');
}

/** Ist dieser Eintrag abgelaufen oder betrifft er die gesuchte Person? */
function shouldRemove(contents, maxAgeDays, searchTerm) {
  let record;
  try {
    record = JSON.parse(contents);
  } catch {
    return { remove: false };
  }

  if (searchTerm) {
    const haystack = JSON.stringify(record.contact ?? {}).toLowerCase();
    if (haystack.includes(searchTerm.toLowerCase())) {
      return { remove: true, reason: 'Löschersuchen' };
    }
  }

  const created = Date.parse(record.created_at ?? '');
  if (!Number.isFinite(created)) return { remove: false };
  const ageDays = (Date.now() - created) / 86_400_000;
  if (ageDays > maxAgeDays) {
    return { remove: true, reason: `${Math.floor(ageDays)} Tage alt` };
  }
  return { remove: false };
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

  // --- Lokal ---
  let removedLocal = 0;
  for (const kind of kinds) {
    const dir = path.join(DIR.appData, kind.dir);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
    if (files.length === 0) continue;

    step(`${kind.label} lokal: ${plural(files.length, 'Eintrag', 'Einträge')}`);
    for (const name of files) {
      const file = path.join(dir, name);
      const outcome = shouldRemove(fs.readFileSync(file, 'utf8'), kind.days, person);
      if (!outcome.remove) continue;
      info(color.gray(`    ${dryRun ? 'würde löschen' : 'gelöscht'}: ${rel(file)} (${outcome.reason})`));
      if (!dryRun) fs.unlinkSync(file);
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
        let entries;
        try {
          entries = await client.list(remoteDir);
        } catch {
          continue;
        }
        const files = entries
          .filter((entry) => entry.type === '-' && entry.name.endsWith('.json'))
          .map((entry) => entry.name)
          .sort();
        if (files.length === 0) continue;

        step(`${kind.label} auf dem Server: ${plural(files.length, 'Eintrag', 'Einträge')}`);
        for (const name of files) {
          const buffer = await client.get(`${remoteDir}/${name}`);
          const outcome = shouldRemove(buffer.toString('utf8'), kind.days, person);
          if (!outcome.remove) continue;
          info(color.gray(`    ${dryRun ? 'würde löschen' : 'gelöscht'}: ${name} (${outcome.reason})`));
          if (!dryRun) await client.delete(`${remoteDir}/${name}`, true).catch(() => {});
          removedRemote += 1;
        }
      }
    } finally {
      await client.end().catch(() => {});
    }
    if (removedRemote === 0) ok('Auf dem Server ist nichts abgelaufen.');
  }

  blank();
  const total = removedLocal + removedRemote;
  if (total === 0) ok('Nichts zu tun.');
  else ok(`${plural(total, 'Eintrag', 'Einträge')} ${dryRun ? 'wären betroffen' : 'gelöscht'}.`);
  blank();
  return 0;
});
