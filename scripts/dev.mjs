/**
 * npm run dev
 *
 * Vorschau, die sich bei Änderungen selbst neu erzeugt.
 *
 * Gedacht zum Arbeiten an Inhalten: Textdatei speichern, Seite neu laden.
 *
 *   --port 8080
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DIR, ROOT } from './lib/paths.mjs';
import { blank, color, heading, info, ok, runMain, warn } from './lib/log.mjs';
import { build } from './build.mjs';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? args[portIndex + 1] : '8080';

const WATCHED = [DIR.content, DIR.src, DIR.config];

runMain(async () => {
  heading('Biblia — Entwicklungsmodus');
  await build({ quiet: true });
  ok('Website erzeugt.');

  const server = spawn(process.execPath, ['scripts/preview.mjs', '--no-build', '--port', String(port)], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  let pending = null;
  let building = false;

  const rebuild = async () => {
    if (building) return;
    building = true;
    try {
      const started = Date.now();
      const outcome = await build({ quiet: true });
      if (outcome.ok) ok(`Neu erzeugt (${Date.now() - started} ms). Seite neu laden.`);
      else warn('Neu erzeugt, aber es gibt fehlerhafte Verweise — Einzelheiten mit:  npm run build');
    } catch (err) {
      warn(`Der Build ist fehlgeschlagen: ${err.message}`);
    } finally {
      building = false;
    }
  };

  for (const dir of WATCHED) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename || filename.includes('/.') || filename.startsWith('.')) return;
      clearTimeout(pending);
      pending = setTimeout(rebuild, 250);
    });
  }

  blank();
  info(color.gray(`    Beobachtet: content/, src/, config/`));
  info(color.gray('    Beenden mit Strg+C'));
  blank();

  const stop = () => {
    server.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await new Promise(() => {});
});
