/**
 * npm run check
 *
 * Prüft alle Inhalte und meldet in einem Durchgang, was zu korrigieren ist.
 * Fehler verhindern den Build, Hinweise nicht.
 *
 *   --strict   Hinweise wie Fehler behandeln
 *   --fix      Erkannte Umbenennungen automatisch in slug_history eintragen
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { DIR, ROOT, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadContent, isScheduled } from './lib/content.mjs';
import { loadI18n } from './lib/i18n.mjs';
import { blank, color, formatBytes, heading, info, ok, warn, error, runMain, plural } from './lib/log.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const fix = args.includes('--fix');

/**
 * Findet Flyer, deren Ordner umbenannt wurde, und trägt den früheren slug
 * in slug_history ein. Ohne diese Historie brechen gedruckte QR-Codes und
 * geteilte Links, sobald jemand einen Titel ändert.
 */
function detectRenames(content) {
  let history = [];
  try {
    const output = execFileSync('git', ['log', '--diff-filter=R', '--name-status', '--format=', '-M', '--', 'content/flyers'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    history = output.split('\n').filter(Boolean);
  } catch {
    return [];
  }

  const renames = [];
  for (const line of history) {
    const m = /^R\d*\t(content\/flyers\/[^/]+)\/flyer\.md\t(content\/flyers\/[^/]+)\/flyer\.md$/.exec(line);
    if (!m) continue;
    const oldSlug = path.basename(m[1]).replace(/^\d+-/, '');
    const newDir = path.basename(m[2]);
    const flyer = content.flyers.find((f) => f.dirName === newDir);
    if (!flyer) continue;
    if (oldSlug === flyer.slug || flyer.slugHistory.includes(oldSlug)) continue;
    renames.push({ flyer, oldSlug });
  }
  return renames;
}

/** Trägt einen früheren slug in flyer.md ein. */
function appendSlugHistory(flyer, oldSlug) {
  const text = fs.readFileSync(flyer.sourceFile, 'utf8');
  const updated = /^slug_history:/m.test(text)
    ? text.replace(/^slug_history:\s*(?:\[\s*\])?\s*$/m, `slug_history:\n  - ${oldSlug}`)
    : text.replace(/^(slug:.*)$/m, `$1\nslug_history:\n  - ${oldSlug}`);
  fs.writeFileSync(flyer.sourceFile, updated);
}

/** Gibt eine Gruppe von Meldungen zu einem Betreff aus. */
function printGroup(subject, items) {
  blank();
  info(color.bold(subject));
  for (const item of items) {
    const mark = item.level === 'error' ? color.red('  ✗') : color.yellow('  ⚠');
    process.stdout.write(`${mark} ${item.message}\n`);
    if (item.file) {
      const where = item.line ? `${rel(item.file)}:${item.line}` : rel(item.file);
      process.stdout.write(color.gray(`      ${where}\n`));
    }
    if (item.hint) process.stdout.write(color.gray(`      ${item.hint}\n`));
  }
}

runMain(async () => {
  const config = loadConfig();

  heading('Biblia — Inhalte prüfen');

  // Oberflächentexte zuerst: ein fehlender Schlüssel bricht sonst erst
  // mitten im Build ab.
  loadI18n(config);
  ok('Oberflächentexte vollständig');

  const content = loadContent(config);
  const { issues } = content;

  // Umbenennungen erkennen.
  const renames = detectRenames(content);
  for (const { flyer, oldSlug } of renames) {
    if (fix) {
      appendSlugHistory(flyer, oldSlug);
      ok(`${flyer.dirName}: früherer Name "${oldSlug}" in slug_history eingetragen`);
    } else {
      issues.warning(flyer.dirName, `Der Flyer hieß früher "${oldSlug}" — es fehlt eine Weiterleitung.`, {
        file: flyer.sourceFile,
        hint: 'Automatisch eintragen lassen mit:  npm run check -- --fix',
      });
    }
  }

  const total = content.flyers.length;
  const withProblems = new Set(issues.items.map((i) => i.subject));
  const complete = content.flyers.filter((f) => !withProblems.has(f.dirName)).length;

  blank();
  ok(plural(total, 'Flyer gefunden', 'Flyer gefunden'));
  ok(`${complete} vollständig`);

  // Überblick je Sprache.
  for (const lang of config.activeLanguages) {
    const published = content.published(lang.code).length;
    const drafts = content.flyers.filter((f) => f.status === 'draft' && f.languages[lang.code]).length;
    const archived = content.flyers.filter((f) => f.status === 'archived' && f.languages[lang.code]).length;
    const parts = [`${published} veröffentlicht`];
    if (drafts > 0) parts.push(`${drafts} Entwurf`);
    if (archived > 0) parts.push(`${archived} archiviert`);
    info(color.gray(`    ${lang.label}: ${parts.join(', ')}`));
  }

  const scheduled = content.flyers.filter((f) => isScheduled(f));
  if (scheduled.length > 0) {
    info(
      color.gray(
        `    ${plural(scheduled.length, 'Flyer ist geplant', 'Flyer sind geplant')} und erscheint erst beim nächsten Build nach dem jeweiligen Datum.`,
      ),
    );
  }

  // Umfang der Druckausgaben, die mit hochgeladen werden.
  const downloads = content.flyers.filter((f) => f.download);
  if (downloads.length > 0) {
    let bytes = 0;
    for (const flyer of downloads) {
      for (const lang of Object.values(flyer.languages)) {
        if (lang.hasOwnPdf && lang.pdf) bytes += fs.statSync(lang.pdf).size;
      }
    }
    info(
      color.gray(
        `    ${plural(downloads.length, 'Flyer wird', 'Flyer werden')} zum Herunterladen angeboten — ${formatBytes(bytes)} zusätzlicher Upload.`,
      ),
    );
  }

  const paid = content.flyers.filter((f) => f.order.enabled && f.order.price > 0);
  if (paid.length > 0) {
    blank();
    warn(`${plural(paid.length, 'Flyer hat', 'Flyer haben')} einen Preis über 0 hinterlegt.`);
    info(
      color.gray(
        '    Sobald Geld verlangt wird, gelten die Informationspflichten des Fern- und Auswärtsgeschäfte-Gesetzes.',
      ),
    );
    info(color.gray('    Das ist vor der Veröffentlichung rechtlich zu klären.'));
  }

  // Meldungen ausgeben.
  const groups = issues.groupedBySubject();
  if (groups.length > 0) {
    const anyErrors = issues.hasErrors;
    heading(anyErrors ? 'Fehler und Hinweise' : 'Hinweise');
    for (const [subject, items] of groups) printGroup(subject, items);
  }

  heading('Ergebnis');
  const errorCount = issues.errors.length;
  const warningCount = issues.warnings.length;

  if (errorCount === 0 && warningCount === 0) {
    ok('Alles in Ordnung.');
    info(color.gray('    Nächster Schritt:  npm run build'));
    blank();
    return 0;
  }

  if (errorCount > 0) {
    error(plural(errorCount, 'Fehler — diese Stellen müssen korrigiert werden', 'Fehler — diese Stellen müssen korrigiert werden'));
  }
  if (warningCount > 0) {
    warn(plural(warningCount, 'Hinweis', 'Hinweise'));
  }
  if (errorCount === 0) {
    blank();
    info(color.gray('    Die Website lässt sich trotzdem erzeugen:  npm run build'));
  }
  blank();
  return errorCount > 0 || (strict && warningCount > 0) ? 1 : 0;
});
