/**
 * Sitemap, robots.txt und .htaccess.
 *
 * Wichtig: nichts davon enthält einen Zeitstempel des Builds. Sonst würde
 * sich bei jedem Lauf jede Datei ändern, der Abgleich beim Hochladen ginge
 * verloren und es würde jedes Mal die komplette Website übertragen.
 */
import { escapeHtml } from './html.mjs';

/** XML-Sitemap aus den gesammelten Einträgen. */
export function renderSitemap(config, entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  for (const entry of entries) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeHtml(config.origin + entry.path)}</loc>`);
    if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) lines.push(`    <priority>${entry.priority}</priority>`);
    for (const alt of entry.alternates ?? []) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${escapeHtml(config.origin + alt.href)}"/>`,
      );
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

/**
 * robots.txt.
 *
 * Achtung: Suchmaschinen lesen robots.txt ausschliesslich im Wurzelverzeichnis
 * der Domain. Liegt die Website in einem Unterverzeichnis, wird diese Datei
 * nie gelesen — die Sperre erfolgt dann über die Kopfzeile in der .htaccess.
 */
export function renderRobots(config) {
  const lines = [];
  if (config.isStaging) {
    lines.push('# Testadresse — nichts soll in den Suchindex.');
    lines.push('User-agent: *');
    lines.push('Disallow: /');
  } else {
    lines.push('User-agent: *');
    lines.push('Allow: /');
    lines.push('');
    lines.push(`Sitemap: ${config.origin}${config.basePath}sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * .htaccess für Apache auf dem Webhosting.
 *
 * Bewusst sparsam: eine fehlerhafte Direktive legt die gesamte Website mit
 * einem Serverfehler lahm. Deshalb keine php_flag-Angaben (die unter
 * PHP-FPM zu einem Fehler 500 führen) und nur die nötigsten Regeln.
 */
export function renderHtaccess(config, { redirects = [], cspHashes = [] }) {
  const lines = [
    '# Diese Datei wird beim Build erzeugt. Änderungen hier gehen verloren.',
    '# Quelle: scripts/lib/seo.mjs',
    '',
    'Options -Indexes',
    'DirectoryIndex index.html',
    `ErrorDocument 404 ${config.basePath}404.html`,
    '',
    '# Eigene Umschreibungsregeln einschalten, auch wenn hier keine stehen.',
    '#',
    '# Hintergrund: liegt im übergeordneten Verzeichnis eine Anwendung mit',
    '# eigenen Regeln, gelten diese sonst auch hier. Auf dem aktuellen Server',
    '# leitet eine solche Regel jede unbekannte Adresse auf /en/... um — damit',
    '# käme die eigene 404-Seite nie zum Zug. Ein eigenes "RewriteEngine On"',
    '# beendet die Vererbung für dieses Verzeichnis.',
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    `  RewriteBase ${config.basePath}`,
    '</IfModule>',
    '',
    '<IfModule mod_headers.c>',
    '  Header always set X-Content-Type-Options "nosniff"',
    '  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    '  Header always set X-Frame-Options "SAMEORIGIN"',
    '  Header always set Cross-Origin-Opener-Policy "same-origin"',
  ];

  // Inhaltssicherheitsrichtlinie. Die Seite bindet nichts von fremden
  // Servern ein — das lässt sich hier hart festschreiben.
  const scriptSrc = ["'self'", ...cspHashes.map((hash) => `'${hash}'`)].join(' ');
  lines.push(
    `  Header always set Content-Security-Policy "default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'"`,
  );

  if (config.isStaging) {
    lines.push('');
    lines.push('  # Testadresse: keine Aufnahme in Suchmaschinen.');
    lines.push('  # Diese Zeile verschwindet automatisch, sobald die endgültige Domain konfiguriert ist.');
    lines.push('  Header always set X-Robots-Tag "noindex, nofollow"');
  }

  lines.push('</IfModule>');
  lines.push('');

  lines.push('<IfModule mod_deflate.c>');
  lines.push('  AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml');
  lines.push('  AddOutputFilterByType DEFLATE application/javascript application/json');
  lines.push('  AddOutputFilterByType DEFLATE image/svg+xml');
  lines.push('</IfModule>');
  lines.push('');

  // Manche Hosting-Umgebungen kennen die neueren Bildformate nicht.
  lines.push('<IfModule mod_mime.c>');
  lines.push('  AddType image/avif .avif');
  lines.push('  AddType image/webp .webp');
  lines.push('  AddType font/woff2 .woff2');
  lines.push('</IfModule>');
  lines.push('');

  lines.push('<IfModule mod_expires.c>');
  lines.push('  ExpiresActive On');
  lines.push('  ExpiresDefault "access plus 1 hour"');
  lines.push('  ExpiresByType text/html "access plus 0 seconds"');
  lines.push('  ExpiresByType image/webp "access plus 1 year"');
  lines.push('  ExpiresByType image/avif "access plus 1 year"');
  lines.push('  ExpiresByType font/woff2 "access plus 1 year"');
  lines.push('</IfModule>');
  lines.push('');

  // Die Asset-Dateinamen enthalten einen Hash, sie dürfen dauerhaft
  // zwischengespeichert werden.
  lines.push('<IfModule mod_headers.c>');
  lines.push('  <FilesMatch "\\.(css|js)$">');
  lines.push('    Header set Cache-Control "public, max-age=31536000, immutable"');
  lines.push('  </FilesMatch>');
  lines.push('  <FilesMatch "\\.html$">');
  lines.push('    Header set Cache-Control "public, max-age=0, must-revalidate"');
  lines.push('  </FilesMatch>');
  lines.push('</IfModule>');

  if (redirects.length > 0) {
    lines.push('');
    lines.push('# Frühere Adressen. Gedruckte QR-Codes und geteilte Links müssen');
    lines.push('# dauerhaft funktionieren, auch wenn sich ein Name ändert.');
    for (const redirect of redirects) {
      lines.push(`Redirect 301 ${redirect.from} ${redirect.to}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
