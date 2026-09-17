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
import { execFileSync } from 'node:child_process';

import { ROOT, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadContent, isScheduled } from './lib/content.mjs';
import { loadI18n } from './lib/i18n.mjs';
import { applyReleaseChecks } from './lib/release.mjs';
import { parseRenames, parseHistoricIds, vanishedIds } from './lib/history.mjs';
import { collectRedirects } from './lib/redirects.mjs';
import { blank, color, formatBytes, heading, info, ok, warn, error, runMain, plural } from './lib/log.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const fix = args.includes('--fix');

/** Fragt Git und liefert die Ausgabe, oder null wenn Git nicht verfügbar ist. */
function git(argv) {
  try {
    return execFileSync('git', argv, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Findet Flyer, deren Ordner umbenannt wurde.
 *
 * Ohne die Historie aus slug_history brechen geteilte Links und
 * Suchergebnisse, sobald jemand einen Titel ändert.
 */
function detectRenames(content) {
  const output = git(['log', '--diff-filter=R', '--name-status', '--format=', '-M', '--', 'content/flyers']);
  if (output === null) return [];

  const renames = [];
  for (const { oldId, oldSlug, newDir } of parseRenames(output)) {
    const flyer = content.flyers.find((f) => f.dirName === newDir);
    if (!flyer) continue;
    // Eine geänderte Nummer ist etwas anderes als ein geänderter Name: sie
    // steht in gedruckten QR-Codes und lässt sich nicht weiterleiten.
    if (oldId !== null && oldId !== flyer.id) {
      renames.push({ flyer, oldSlug, oldId });
      continue;
    }
    if (oldSlug === flyer.slug || flyer.slugHistory.includes(oldSlug)) continue;
    renames.push({ flyer, oldSlug, oldId: null });
  }
  return renames;
}

/**
 * Jede Nummer, die es in diesem Projekt je gegeben hat.
 *
 * Die Nummer ist die einzige Zusage, die dieses Projekt nach aussen macht:
 * /f/123/ steht auf gedruckten Flyern und muss jahrelang funktionieren.
 * Wird ein Ordner gelöscht oder umnummeriert, fällt das ohne diese Prüfung
 * niemandem auf — die Inhalte für sich sind dann ja widerspruchsfrei.
 */
function historicFlyerIds() {
  const output = git(['log', '--pretty=format:', '--name-only', '--', 'content/flyers']);
  return output === null ? null : parseHistoricIds(output);
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
  for (const { flyer, oldSlug, oldId } of renames) {
    if (oldId) {
      issues.error(flyer.dirName, `Die dauerhafte Nummer wurde von ${oldId} auf ${flyer.id} geändert.`, {
        file: flyer.sourceFile,
        hint:
          `Die Adresse /f/${oldId}/ steht auf gedruckten Flyern und ist damit unwiederbringlich kaputt.\n` +
          `      Benenne den Ordner zurück auf ${oldId}-${flyer.slug} und setze  id: ${oldId}.`,
      });
      continue;
    }
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

  // Verschwundene Nummern erkennen.
  const historic = historicFlyerIds();
  if (historic) {
    for (const id of vanishedIds(historic, content.flyersById, config.retiredFlyerIds)) {
      issues.error('Dauerhafte Adressen', `Die Nummer ${id} gab es schon einmal, heute gibt es sie nicht mehr.`, {
        hint:
          `Die Adresse /f/${id}/ liefert damit einen Fehler 404 — auch auf schon gedruckten Flyern.\n` +
          `      Einen Flyer aus dem Verkehr ziehen:  status: archived (die Adresse bleibt erreichbar).\n` +
          `      War die Nummer nie im Umlauf, in config/site.json eintragen:  "retiredFlyerIds": [${id}]`,
      });
    }
  }

  // Freigabe für die endgültige Domain.
  const release = applyReleaseChecks({ config, content });

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

  const redirects = collectRedirects({ config, content });
  if (redirects.length > 0) {
    info(
      color.gray(
        `    ${plural(redirects.length, 'frühere Adresse wird weitergeleitet', 'frühere Adressen werden weitergeleitet')}.`,
      ),
    );
  }

  // Freigabe für die endgültige Domain.
  blank();
  if (release.problems.length === 0) {
    ok(`Bereit für die endgültige Domain${config.isStaging ? '' : ` (${config.canonicalDomain})`}.`);
  } else if (release.level === 'warning') {
    warn(
      `${plural(release.problems.length, 'Punkt ist', 'Punkte sind')} vor dem Umzug auf ${config.canonicalDomain ?? 'die endgültige Domain'} zu erledigen.`,
    );
    info(color.gray('    Auf der Testadresse ist das in Ordnung — die Einzelheiten stehen unten.'));
  } else {
    error(
      `${plural(release.problems.length, 'Punkt verhindert', 'Punkte verhindern')} die Veröffentlichung unter ${config.canonicalDomain}.`,
    );
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
