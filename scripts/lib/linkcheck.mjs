/**
 * Prüft die erzeugte Website auf kaputte interne Verweise.
 *
 * Der eigentliche Zweck: die Website liegt in einem Unterverzeichnis. Eine
 * von Hand geschriebene Adresse wie "/de/flyer/" sähe im Quelltext richtig
 * aus, würde aber erst nach dem Hochladen als Fehler auffallen. Diese
 * Prüfung findet so etwas sofort beim Build.
 *
 * Zusätzlich wird sichergestellt, dass nichts von fremden Servern geladen
 * wird — das ist die Grundlage dafür, ohne Einwilligungsbanner auszukommen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { listFilesRecursive } from './emit.mjs';

/** Adressen in Attributen, die auf Dateien zeigen. */
const ATTRIBUTE_PATTERN = /\s(?:href|src|action|poster)\s*=\s*"([^"]*)"/gi;
const SRCSET_PATTERN = /\ssrcset\s*=\s*"([^"]*)"/gi;

/** Diese Schemata zeigen nie auf eine Datei dieser Website. */
const IGNORED_SCHEME = /^(?:mailto:|tel:|data:|javascript:|#|blob:)/i;

/** Erlaubte fremde Ziele — bewusst leer: die Seite lädt nichts von aussen. */
const ALLOWED_EXTERNAL_HOSTS = [];

function collectTargets(html) {
  const targets = new Set();

  for (const match of html.matchAll(ATTRIBUTE_PATTERN)) {
    targets.add(match[1].trim());
  }
  for (const match of html.matchAll(SRCSET_PATTERN)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) targets.add(url);
    }
  }
  return targets;
}

/**
 * @param {string} distDir
 * @param {object} config
 * @returns {{checked:number, problems:Array, external:Array}}
 */
export function checkLinks(distDir, config) {
  const files = new Set(listFilesRecursive(distDir));
  const problems = [];
  const external = new Set();
  let checked = 0;

  const htmlFiles = [...files].filter((file) => file.endsWith('.html')).sort();

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(distDir, file), 'utf8');

    for (const rawTarget of collectTargets(html)) {
      if (rawTarget === '' || IGNORED_SCHEME.test(rawTarget)) continue;

      // Vollständige Adressen: eigene Domain prüfen, fremde melden.
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith('//')) {
        const normalized = rawTarget.startsWith('//') ? `https:${rawTarget}` : rawTarget;
        let host;
        try {
          host = new URL(normalized).host;
        } catch {
          problems.push({ page: file, target: rawTarget, reason: 'Die Adresse ist nicht lesbar.' });
          continue;
        }
        if (host !== new URL(config.origin).host) {
          if (!ALLOWED_EXTERNAL_HOSTS.includes(host)) external.add(`${host} (in ${file})`);
          continue;
        }
        // Eigene Domain, absolut geschrieben — weiter wie ein interner Verweis.
      }

      checked += 1;
      const withoutFragment = rawTarget.split('#')[0].split('?')[0];
      if (withoutFragment === '') continue;

      const internal = config.urls.stripBase(withoutFragment);
      if (internal === null) {
        problems.push({
          page: file,
          target: rawTarget,
          reason:
            config.basePath === '/'
              ? 'Die Adresse liegt ausserhalb der Website.'
              : `Der Basispfad ${config.basePath} fehlt. Adressen niemals von Hand schreiben, sondern über scripts/lib/url.mjs bauen.`,
        });
        continue;
      }

      // Zieldatei bestimmen: Verzeichnisse verweisen auf ihre index.html.
      const relative = internal.replace(/^\//, '');
      const candidates =
        relative === '' || relative.endsWith('/')
          ? [`${relative}index.html`]
          : [relative, `${relative}/index.html`];

      if (!candidates.some((candidate) => files.has(candidate))) {
        problems.push({
          page: file,
          target: rawTarget,
          reason: `Die Datei ${candidates[0]} gibt es in dist/ nicht.`,
        });
      }
    }
  }

  return {
    checked,
    problems,
    external: [...external].sort(),
    pages: htmlFiles.length,
  };
}
