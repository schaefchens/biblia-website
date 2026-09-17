/**
 * Schriften für die serverseitig erzeugten Bilder.
 *
 * Für die Bilder zum Teilen werden feste Schriftschnitte registriert, keine
 * variablen: Canvas kann bei variablen Schriften die Strichstärke nicht
 * auswählen und zeichnet immer dieselbe. Feste Schnitte sorgen außerdem
 * dafür, dass die Bilder auf jedem Rechner gleich aussehen — sonst wäre der
 * Zwischenspeicher wertlos, weil dasselbe Bild überall anders entstünde.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { GlobalFonts } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);

/** Registrierte Familiennamen, nach Verwendungszweck. */
export const FONT = {
  serifRegular: 'BibliaSerifRegular',
  serifSemibold: 'BibliaSerifSemibold',
  sansRegular: 'BibliaSansRegular',
  sansMedium: 'BibliaSansMedium',
};

const REGISTRATIONS = [
  ['@fontsource/source-serif-4', 'source-serif-4-latin-400-normal.woff2', FONT.serifRegular],
  ['@fontsource/source-serif-4', 'source-serif-4-latin-600-normal.woff2', FONT.serifSemibold],
  ['@fontsource/inter', 'inter-latin-400-normal.woff2', FONT.sansRegular],
  ['@fontsource/inter', 'inter-latin-500-normal.woff2', FONT.sansMedium],
];

let registered = false;

/** Registriert die Schriften einmalig. */
export function registerFonts() {
  if (registered) return;
  for (const [pkg, file, family] of REGISTRATIONS) {
    const source = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
    if (!fs.existsSync(source)) {
      throw new Error(
        `Schriftdatei fehlt: ${source}\nOhne sie sehen die Bilder zum Teilen auf jedem Rechner anders aus. Ausführen:  npm ci`,
      );
    }
    GlobalFonts.registerFromPath(source, family);
  }
  registered = true;
}

/** Kennung aller registrierten Schriften — gehört in den Schlüssel des Zwischenspeichers. */
export const FONT_VERSION = REGISTRATIONS.map(([pkg, file]) => `${pkg}/${file}`).join('|');
