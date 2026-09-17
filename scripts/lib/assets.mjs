/**
 * Bündelt CSS und JavaScript und kopiert die Schriften.
 *
 * Die Dateinamen enthalten einen Hash des Inhalts. Dadurch können sie auf
 * dem Server dauerhaft zwischengespeichert werden, und eine Änderung wirkt
 * trotzdem sofort.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { DIR } from './paths.mjs';
import { shortHash } from './emit.mjs';

const require = createRequire(import.meta.url);

/** Die Schriftdateien, die tatsächlich eingebunden werden. */
const FONT_FILES = [
  ['@fontsource-variable/source-serif-4', 'source-serif-4-latin-wght-normal.woff2', true],
  ['@fontsource-variable/source-serif-4', 'source-serif-4-latin-ext-wght-normal.woff2', false],
  ['@fontsource-variable/source-serif-4', 'source-serif-4-latin-wght-italic.woff2', false],
  ['@fontsource-variable/inter', 'inter-latin-wght-normal.woff2', true],
  ['@fontsource-variable/inter', 'inter-latin-ext-wght-normal.woff2', false],
];

/** Reihenfolge der CSS-Dateien — Tokens zuerst. */
const CSS_ENTRY = [
  'fonts.css',
  'tokens.css',
  'base.css',
  'layout.css',
  'components.css',
  'pages.css',
  'reader.css',
  'forms.css',
];

/**
 * @param {object} options
 * @param {import('./emit.mjs').Emitter} options.emitter
 * @param {object} options.urls   URL-Helfer aus der Konfiguration
 * @param {boolean} [options.minify]
 */
export async function buildAssets({ emitter, urls, minify = true }) {
  // --- Schriften ---
  const preloadFonts = [];
  for (const [pkg, file, preload] of FONT_FILES) {
    const source = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
    if (!fs.existsSync(source)) {
      throw new Error(`Schriftdatei fehlt: ${source}. Ausführen:  npm ci`);
    }
    const target = `assets/fonts/${file}`;
    emitter.copy(target, source);
    if (preload) preloadFonts.push(urls.file(target));
  }

  // --- CSS ---
  const cssSource = CSS_ENTRY.map((name) => `@import "${name}";`).join('\n');
  const css = await esbuild.build({
    stdin: {
      contents: cssSource,
      resolveDir: DIR.css,
      loader: 'css',
    },
    bundle: true,
    minify,
    write: false,
    // Schriftdateien nicht mitbündeln — sie werden separat kopiert und
    // über relative Adressen gefunden.
    external: ['*.woff2', '*.woff'],
    legalComments: 'none',
    target: ['chrome111', 'firefox121', 'safari16.4', 'edge111'],
  });
  const cssText = css.outputFiles[0].text;
  const cssName = `assets/app.${shortHash(cssText)}.css`;
  emitter.add(cssName, cssText);

  // --- JavaScript ---
  const js = await esbuild.build({
    entryPoints: [path.join(DIR.js, 'app.mjs')],
    bundle: true,
    minify,
    write: false,
    format: 'esm',
    target: ['chrome111', 'firefox121', 'safari16.4', 'edge111'],
    legalComments: 'none',
  });
  const jsText = js.outputFiles[0].text;
  const jsName = `assets/app.${shortHash(jsText)}.js`;
  emitter.add(jsName, jsText);

  return {
    css: urls.file(cssName),
    js: urls.file(jsName),
    preloadFonts,
    sizes: { css: Buffer.byteLength(cssText), js: Buffer.byteLength(jsText) },
  };
}
