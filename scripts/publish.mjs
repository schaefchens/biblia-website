/**
 * npm run publish
 *
 * Der eine Befehl für den Alltag: prüfen, erzeugen, sichern, hochladen.
 *
 *   1. Inhalte prüfen
 *   2. Website erzeugen
 *   3. Änderungen in Git sichern und zum Remote schicken
 *   4. Auf den Server hochladen
 *
 * Git läuft im Hintergrund mit. Die Mitarbeiter müssen es nicht bedienen.
 *
 *   --dry-run     Nichts verändern
 *   --no-git      Ohne Sicherung in Git
 *   --message X   Eigener Text für die Sicherung
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadContent } from './lib/content.mjs';
import { build } from './build.mjs';
import {
  blank, color, error, formatDuration, heading, info, ok, plural, runMain, step, warn, fail,
} from './lib/log.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noGit = args.includes('--no-git');
const messageIndex = args.indexOf('--message');
const customMessage = messageIndex >= 0 ? args[messageIndex + 1] : null;

function git(argv, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFailure) return null;
    throw err;
  }
}

const hasGit = () => git(['rev-parse', '--git-dir'], { allowFailure: true }) !== null;

/**
 * Sichert die Inhalte in Git.
 *
 * Wichtig: es wird niemals blind alles hinzugefügt. Unter app-data/ liegen
 * Namen und Postadressen — landen die einmal in der Versionsgeschichte,
 * bekommt man sie praktisch nicht mehr heraus.
 */
function commitChanges(summary) {
  const status = git(['status', '--porcelain'], { allowFailure: true }) ?? '';
  const entries = status.split('\n').filter(Boolean);

  const personal = entries.filter((line) => /\sapp-data\//.test(` ${line.slice(3)}`) || line.slice(3).startsWith('app-data/'));
  if (personal.length > 0) {
    fail(
      'Unter app-data/ liegen Dateien, die Git sieht.',
      'Dort stehen Namen und Postadressen. Sie dürfen nicht ins Repository.\n' +
        '  Prüfe, ob "app-data/" in .gitignore steht, und führe dann aus:\n' +
        '      git rm -r --cached app-data',
    );
  }

  if (entries.length === 0) {
    info(color.gray('    Keine Änderungen zu sichern.'));
    return false;
  }

  if (dryRun) {
    info(color.gray(`    ${plural(entries.length, 'Änderung würde gesichert', 'Änderungen würden gesichert')}.`));
    return false;
  }

  git(['add', '--', 'content', 'config', 'src', 'scripts', 'server', 'package.json', 'package-lock.json', '.gitignore', '.gitattributes', 'README.md']);

  const staged = git(['diff', '--cached', '--name-only'], { allowFailure: true }) ?? '';
  if (staged.trim() === '') {
    info(color.gray('    Keine Änderungen zu sichern.'));
    return false;
  }

  git(['commit', '-m', customMessage ?? summary]);
  ok(`Gesichert: ${plural(staged.split('\n').filter(Boolean).length, 'Datei', 'Dateien')}`);
  return true;
}

/** Schickt die Sicherung zum Remote. */
function pushChanges() {
  const remotes = git(['remote'], { allowFailure: true }) ?? '';
  if (remotes.trim() === '') {
    warn('Es ist kein Git-Remote eingerichtet — die Inhalte sind nur auf diesem Rechner gesichert.');
    info(color.gray('    Ein privates Repository verbinden:  git remote add origin <adresse>'));
    return;
  }
  if (dryRun) return;

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true }) ?? 'main';
  const result = spawnSync('git', ['push', '--set-upstream', remotes.split('\n')[0], branch], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status === 0) {
    ok('Sicherung zum Remote geschickt.');
  } else {
    warn('Die Sicherung konnte nicht zum Remote geschickt werden.');
    info(color.gray(`    ${(result.stderr ?? '').trim().split('\n').slice(-2).join(' ')}`));
    info(color.gray('    Das Hochladen der Website läuft trotzdem weiter.'));
  }
}

runMain(async () => {
  const started = Date.now();
  const config = loadConfig();

  heading('Biblia Veröffentlichung');
  if (dryRun) warn('Probelauf — es wird nichts verändert.');

  // --- 1. Prüfen ---
  step('Inhalte prüfen');
  const content = loadContent(config);
  const errors = content.issues.errors;
  const warnings = content.issues.warnings;

  info(color.gray(`    ${plural(content.flyers.length, 'Flyer geprüft', 'Flyer geprüft')}`));
  if (errors.length > 0) {
    blank();
    error(plural(errors.length, 'Fehler im Inhalt', 'Fehler im Inhalt'));
    for (const issue of errors.slice(0, 5)) info(`${color.bold(issue.subject)}: ${issue.message}`);
    blank();
    info('Vollständige Liste mit:  npm run check');
    info('Es wurde nichts verändert und nichts hochgeladen.');
    blank();
    return 1;
  }
  if (warnings.length > 0) {
    info(color.gray(`    ${plural(warnings.length, 'Hinweis', 'Hinweise')} — Einzelheiten mit:  npm run check`));
  }

  // --- 2. Erzeugen ---
  blank();
  step('Statische Website wird erzeugt');
  const outcome = await build({ quiet: true });
  if (!outcome.ok) {
    blank();
    error('Die Website konnte nicht fehlerfrei erzeugt werden.');
    info('Einzelheiten mit:  npm run build');
    blank();
    return 1;
  }
  info(
    color.gray(
      `    ${plural(outcome.emitter.size, 'Datei', 'Dateien')}, davon ${outcome.result.written} neu oder geändert`,
    ),
  );

  // --- 3. Sichern ---
  blank();
  if (noGit) {
    info(color.gray('    Sicherung in Git übersprungen (--no-git).'));
  } else if (!hasGit()) {
    warn('Dieser Ordner ist kein Git-Repository — es wird nichts gesichert.');
  } else {
    step('Inhalte sichern');
    const summary = `Inhalte aktualisiert: ${content.flyers.length} Flyer`;
    commitChanges(summary);
    pushChanges();
  }

  // --- 4. Hochladen ---
  blank();
  step('Website wird hochgeladen');
  if (dryRun) {
    info(color.gray('    Übersprungen (Probelauf). Einzeln ausprobieren:  npm run deploy -- --dry-run'));
    blank();
    return 0;
  }

  const deploy = spawnSync(process.execPath, ['scripts/deploy.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  blank();
  if (deploy.status !== 0) {
    error('Das Hochladen ist fehlgeschlagen.');
    info('Der Vorgang lässt sich gefahrlos wiederholen:  npm run deploy');
    blank();
    return 1;
  }

  heading('Fertig');
  ok(`${plural(content.flyers.length, 'Flyer', 'Flyer')} veröffentlicht in ${formatDuration(Date.now() - started)}.`);
  info(`    ${config.baseUrl}`);
  blank();
  return 0;
});
