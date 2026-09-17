/**
 * npm run fetch
 *
 * Holt Bestellanfragen und Kontaktnachrichten vom Server.
 *
 * Ausschliesslich in eine Richtung: Server → lokal. Inhalte der Website
 * werden nie heruntergeladen, und lokale Dateien werden nie überschrieben.
 *
 *   --archive   Heruntergeladenes auf dem Server in ein Archiv verschieben
 *   --remote-root X
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadDeployConfig, connect, ensureDirectory } from './lib/sftp.mjs';
import { blank, color, heading, info, ok, plural, runMain, step, warn } from './lib/log.mjs';

const args = process.argv.slice(2);
const archive = args.includes('--archive');
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const KINDS = [
  { remote: 'orders', local: 'orders', label: 'Bestellanfragen' },
  { remote: 'contact', local: 'contact', label: 'Kontaktnachrichten' },
];

runMain(async () => {
  loadConfig();
  const deploy = loadDeployConfig({ remoteRootOverride: option('--remote-root') });

  heading('Biblia — Anfragen vom Server holen');
  info(color.gray(`    Quelle: ${deploy.username}@${deploy.host}:${deploy.remoteRoot}/app-data`));
  blank();

  const client = await connect(deploy);
  let total = 0;
  let skipped = 0;

  try {
    for (const kind of KINDS) {
      const remoteDir = `${deploy.remoteRoot}/app-data/${kind.remote}`;
      const localDir = path.join(DIR.appData, kind.local);

      let entries;
      try {
        entries = await client.list(remoteDir);
      } catch {
        info(color.gray(`    ${kind.label}: noch keine vorhanden`));
        continue;
      }

      const files = entries
        .filter((entry) => entry.type === '-' && entry.name.endsWith('.json'))
        .map((entry) => entry.name)
        .sort();

      if (files.length === 0) {
        info(color.gray(`    ${kind.label}: noch keine vorhanden`));
        continue;
      }

      step(`${kind.label}: ${plural(files.length, 'Eintrag', 'Einträge')} auf dem Server`);
      fs.mkdirSync(localDir, { recursive: true });

      let fetched = 0;
      for (const name of files) {
        const target = path.join(localDir, name);
        // Lokale Daten haben Vorrang und werden nie überschrieben.
        if (fs.existsSync(target)) {
          skipped += 1;
          continue;
        }
        const buffer = await client.get(`${remoteDir}/${name}`);
        fs.writeFileSync(target, buffer);
        fs.chmodSync(target, 0o600);
        fetched += 1;
        total += 1;
      }

      if (fetched > 0) ok(`${plural(fetched, 'neuer Eintrag', 'neue Einträge')} nach ${rel(localDir)}`);
      else info(color.gray('    Nichts Neues.'));

      if (archive && files.length > 0) {
        const archiveDir = `${remoteDir}/archiv`;
        await ensureDirectory(client, archiveDir);
        for (const name of files) {
          await client.rename(`${remoteDir}/${name}`, `${archiveDir}/${name}`).catch(() => {});
        }
        info(color.gray(`    Auf dem Server nach archiv/ verschoben.`));
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  blank();
  if (total === 0) ok('Es gibt nichts Neues.');
  else ok(`${plural(total, 'Eintrag geholt', 'Einträge geholt')}.`);
  if (skipped > 0) info(color.gray(`    ${plural(skipped, 'Eintrag war', 'Einträge waren')} schon lokal vorhanden.`));

  blank();
  warn('Diese Dateien enthalten Namen und Postadressen.');
  info(color.gray(`    Sie liegen in ${rel(DIR.appData)} und sind von Git ausgenommen.`));
  info(color.gray('    Bitte nicht per E-Mail weitergeben und nicht in geteilte Ordner kopieren.'));
  blank();
  return 0;
});
