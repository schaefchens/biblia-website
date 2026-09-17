/**
 * npm run clean
 *
 * Entfernt erzeugte Dateien. Inhalte und Zugangsdaten bleiben unberührt.
 *
 *   --all   Auch den Zwischenspeicher der Bilder löschen
 *           (der nächste Build dauert dann deutlich länger)
 */
import fs from 'node:fs';
import { resolveHome, rel } from './lib/paths.mjs';
import { blank, color, formatBytes, heading, info, ok, runMain } from './lib/log.mjs';

const all = process.argv.slice(2).includes('--all');

function sizeOf(dir) {
  if (!fs.existsSync(dir)) return 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      try {
        bytes += fs.statSync(`${entry.parentPath ?? entry.path}/${entry.name}`).size;
      } catch {
        /* egal */
      }
    }
  }
  return bytes;
}

runMain(async () => {
  const home = resolveHome();
  heading('Biblia — Aufräumen');

  const targets = [
    { dir: home.dist, label: 'Fertige Website' },
    { dir: home.printAssets, label: 'QR-Codes für den Druck' },
  ];
  if (all) targets.push({ dir: home.cache, label: 'Zwischenspeicher der Bilder' });

  let freed = 0;
  for (const target of targets) {
    if (!fs.existsSync(target.dir)) continue;
    const bytes = sizeOf(target.dir);
    fs.rmSync(target.dir, { recursive: true, force: true });
    freed += bytes;
    ok(`${target.label} entfernt ${color.gray(`(${rel(target.dir)}, ${formatBytes(bytes)})`)}`);
  }

  blank();
  ok(freed > 0 ? `${formatBytes(freed)} freigegeben.` : 'Es gab nichts aufzuräumen.');
  if (!all) info(color.gray('    Der Zwischenspeicher der Bilder bleibt erhalten. Auch löschen:  npm run clean -- --all'));
  info(color.gray('    Inhalte in content/ und die Datei sftp.env wurden nicht angefasst.'));
  blank();
  return 0;
});
