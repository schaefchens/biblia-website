/**
 * Das Zeichen der Website im Browser-Tab.
 *
 * Ohne diese Dateien fragt jeder Browser /favicon.ico an und bekommt einen
 * Fehler 404 — in den Server-Protokollen und in den Entwicklerwerkzeugen
 * jedes Besuchers.
 *
 * Die PNG-Fassungen entstehen mit derselben Schrift wie die Bilder zum
 * Teilen. Dadurch sehen sie auf jedem Rechner gleich aus, und der Vergleich
 * beim Hochladen bleibt zuverlässig: eine Datei, die sich bei jedem Build
 * ändert, würde jedes Mal neu übertragen.
 */
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { registerFonts, FONT } from './fonts.mjs';

/** Farben der Marke — bewusst dieselben wie in src/css/tokens.css. */
const MARK = {
  background: '#a8553a',
  letter: '#faf7f2',
  letterText: 'B',
};

/** Die Größen, die tatsächlich gebraucht werden. */
const SIZES = [
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-180.png', size: 180 },
  { file: 'icon-512.png', size: 512 },
];

/** Zeichnet die Marke in der angegebenen Kantenlänge. */
function drawMark(size) {
  registerFonts();
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');

  // Abgerundetes Quadrat in der Akzentfarbe.
  const radius = size * 0.22;
  context.fillStyle = MARK.background;
  context.beginPath();
  context.roundRect(0, 0, size, size, radius);
  context.fill();

  context.fillStyle = MARK.letter;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.font = `${Math.round(size * 0.68)}px "${FONT.serifSemibold}"`;
  // Optisch mittig statt rechnerisch: Versalien sitzen ohne Unterlänge
  // sonst sichtbar zu tief.
  context.fillText(MARK.letterText, size / 2, size * 0.755);

  return canvas.toBuffer('image/png');
}

/**
 * Die SVG-Fassung für moderne Browser.
 *
 * Bewusst mit einer allgemeinen Schriftfamilie: die Datei wird vom Browser
 * gezeichnet, nicht von uns, und jedes System hat eine Serifenschrift.
 */
function markSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Biblia">',
    `  <rect width="64" height="64" rx="14" fill="${MARK.background}"/>`,
    `  <text x="32" y="48.5" text-anchor="middle" fill="${MARK.letter}"`,
    '        font-family="Iowan Old Style, Palatino, Georgia, Times New Roman, serif"',
    `        font-size="44" font-weight="600">${MARK.letterText}</text>`,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Verpackt ein PNG als ICO-Datei.
 *
 * Seit Windows Vista darf in einer ICO-Datei ein vollständiges PNG stehen.
 * Damit genügen 22 Byte Kopf — eine echte Umwandlung in das alte
 * Bitmap-Format ist nicht nötig.
 */
function wrapAsIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserviert
  header.writeUInt16LE(1, 2); // 1 = Symbol
  header.writeUInt16LE(1, 4); // ein einziges Bild
  header.writeUInt8(size >= 256 ? 0 : size, 6);
  header.writeUInt8(size >= 256 ? 0 : size, 7);
  header.writeUInt8(0, 8); // keine Farbtabelle
  header.writeUInt8(0, 9); // reserviert
  header.writeUInt16LE(1, 10); // Ebenen
  header.writeUInt16LE(32, 12); // Bit je Bildpunkt
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

/**
 * Legt Zeichen und Verweise an.
 *
 * @param {object} options
 * @param {import('./emit.mjs').Emitter} options.emitter
 * @param {object} options.urls  URL-Helfer aus der Konfiguration
 * @returns {Promise<{svg:string, png32:string, appleTouch:string}>}
 */
export async function buildFavicons({ emitter, urls }) {
  const base = drawMark(512);

  for (const { file, size } of SIZES) {
    const data =
      size === 512 ? base : await sharp(base).resize(size, size, { fit: 'cover' }).png().toBuffer();
    emitter.add(`assets/${file}`, data);
  }
  emitter.add('assets/icon.svg', markSvg());

  // Manche Browser und Suchmaschinen fragen diese Adresse ohne Verweis an.
  const small = await sharp(base).resize(32, 32, { fit: 'cover' }).png().toBuffer();
  emitter.add('favicon.ico', wrapAsIco(small, 32));

  return {
    svg: urls.file('assets/icon.svg'),
    png32: urls.file('assets/icon-32.png'),
    appleTouch: urls.file('assets/icon-180.png'),
    ico: urls.file('favicon.ico'),
  };
}
