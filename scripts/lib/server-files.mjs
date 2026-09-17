/**
 * Übernimmt die PHP-Dateien in die fertige Website und erzeugt die
 * Konfiguration, die sie zur Laufzeit brauchen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR } from './paths.mjs';
import { buildCatalog } from './catalog.mjs';

/** Alle PHP-Dateien unterhalb von server/api. */
function listPhpFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listPhpFiles(path.join(dir, entry.name), relative));
    else if (entry.name.endsWith('.php')) out.push(relative);
  }
  return out;
}

/** PHP-Wert einer einfachen Struktur — bewusst ohne var_export-Eigenheiten. */
function toPhp(value, indent = '  ') {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => `${indent}  ${toPhp(item, `${indent}  `)},`).join('\n');
    return `[\n${items}\n${indent}]`;
  }
  if (typeof value === 'object') {
    const items = Object.entries(value)
      .map(([key, entry]) => `${indent}  ${JSON.stringify(String(key))} => ${toPhp(entry, `${indent}  `)},`)
      .join('\n');
    return `[\n${items}\n${indent}]`;
  }
  return JSON.stringify(String(value));
}

/**
 * @param {object} options
 * @param {import('./emit.mjs').Emitter} options.emitter
 * @param {object} options.config
 * @param {object} options.content
 * @param {object} options.assets
 */
export function buildServerFiles({ emitter, config, content, assets }) {
  const apiDir = path.join(DIR.server, 'api');
  for (const file of listPhpFiles(apiDir)) {
    emitter.copy(`api/${file}`, path.join(apiDir, file));
  }

  const runtime = {
    siteName: config.siteName,
    origin: config.origin,
    basePath: config.basePath,
    baseUrl: config.baseUrl,
    isStaging: config.isStaging,
    languages: config.languageCodes,
    defaultLanguage: config.defaultLanguage,
    orderEmail: config.order?.recipientEmail ?? '',
    contactEmail: config.contact?.recipientEmail ?? '',
    senderEmail: config.order?.senderEmail ?? '',
    cssUrl: assets.css,
    // Liegt ausserhalb des Webverzeichnisses, wenn das Hosting es erlaubt;
    // sonst greift die .htaccess in app-data/.
    dataDir: null,
  };

  emitter.add(
    'api/config.generated.php',
    [
      '<?php',
      '',
      '/**',
      ' * Diese Datei wird beim Build erzeugt. Änderungen hier gehen verloren.',
      ' * Quelle: config/site.json und scripts/lib/server-files.mjs',
      ' */',
      '',
      'declare(strict_types=1);',
      '',
      `return ${toPhp(runtime)};`,
      '',
    ].join('\n'),
  );

  // Der bestellbare Bestand. Der Endpunkt nimmt ausschliesslich an, was
  // hier steht — Nummer, Verfügbarkeit und erlaubte Menge.
  const catalog = buildCatalog({ config, content });
  emitter.add(
    'api/catalog.generated.php',
    [
      '<?php',
      '',
      '/**',
      ' * Diese Datei wird beim Build erzeugt. Änderungen hier gehen verloren.',
      ' * Quelle: content/flyers/ und scripts/lib/catalog.mjs',
      ' *',
      ' * Sie ist die einzige gültige Liste bestellbarer Flyer. Alles, was der',
      ' * Browser mitschickt, wird dagegen geprüft.',
      ' */',
      '',
      'declare(strict_types=1);',
      '',
      `return ${toPhp(catalog)};`,
      '',
    ].join('\n'),
  );

  // Laufzeitdaten sperren. Bestell- und Kontaktdaten enthalten Namen und
  // Postadressen und dürfen unter keinen Umständen abrufbar sein.
  // Nach jedem Hochladen wird zusätzlich über HTTP geprüft, dass hier
  // wirklich 403 zurückkommt.
  const denyAccess = [
    '# Laufzeitdaten. Enthalten personenbezogene Daten.',
    '# Kein Zugriff über das Web, unter keinen Umständen.',
    '',
    '<IfModule mod_authz_core.c>',
    '  Require all denied',
    '</IfModule>',
    '<IfModule !mod_authz_core.c>',
    '  Order allow,deny',
    '  Deny from all',
    '</IfModule>',
    '',
    '# Falls das Sperren über die Zugriffsregeln nicht greift, wird',
    '# zumindest keine Datei mehr als Programm ausgeführt.',
    '<IfModule mod_php.c>',
    '  php_flag engine off',
    '</IfModule>',
    '',
  ].join('\n');

  // Die Hilfsdateien der API werden nur eingebunden, nie direkt aufgerufen.
  // Solange PHP läuft, geben sie ohnehin nichts aus. Sollte PHP auf dem
  // Server aber einmal nicht ausgeführt werden, würde der Quelltext samt
  // Einstellungen ausgeliefert — das verhindert diese Sperre.
  emitter.add('api/_lib/.htaccess', denyAccess);

  emitter.add('app-data/.htaccess', denyAccess);
  // Verzeichnisauflistung zusätzlich verhindern, falls .htaccess ignoriert wird.
  emitter.add('app-data/index.html', '<!doctype html>\n<title>403</title>\n');

  return { files: listPhpFiles(apiDir).length, catalog };
}
