/**
 * PDF-Seiten zu Bildern und Text.
 *
 * Läuft bewusst der Reihe nach statt parallel: mit einem korrekten
 * Zwischenspeicher zählt nur der erste vollständige Durchlauf, und
 * pdfjs zusammen mit nativem Canvas in mehreren Threads ist eine
 * Fehlerquelle, die man sich ohne Messung nicht einhandeln muss.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));

// pdfjs erwartet diese Typen global. Ohne sie bricht das Zeichnen ab oder
// liefert stillschweigend falsche Ergebnisse.
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.Path2D ??= Path2D;
globalThis.ImageData ??= ImageData;

/**
 * Eigene Canvas-Fabrik.
 * Die eingebaute greift auf das Paket "canvas" zu, das beim Installieren
 * kompiliert werden müsste — genau das soll auf den Rechnern der
 * Mitarbeiter nicht nötig sein.
 */
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(entry, width, height) {
    entry.canvas.width = Math.ceil(width);
    entry.canvas.height = Math.ceil(height);
  }
  destroy(entry) {
    entry.canvas.width = 0;
    entry.canvas.height = 0;
    entry.canvas = null;
    entry.context = null;
  }
}

/** Fehler beim Lesen eines PDFs — führt zu einer Warnung, nicht zum Abbruch. */
export class PdfError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'PdfError';
    this.hint = hint;
  }
}

/** Öffnet ein PDF mit den für Node nötigen Einstellungen. */
async function openDocument(file) {
  let data;
  try {
    data = new Uint8Array(fs.readFileSync(file));
  } catch {
    throw new PdfError('Die PDF-Datei konnte nicht gelesen werden.');
  }

  const task = pdfjs.getDocument({
    data,
    // Ohne diesen Pfad werden Standardschriften still durch falsche
    // Glyphen ersetzt, statt einen Fehler zu melden.
    standardFontDataUrl: `${path.join(PDFJS_ROOT, 'standard_fonts')}${path.sep}`,
    cMapUrl: `${path.join(PDFJS_ROOT, 'cmaps')}${path.sep}`,
    cMapPacked: true,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    CanvasFactory: NodeCanvasFactory,
  });

  try {
    const document = await task.promise;
    return { document, task };
  } catch (err) {
    await task.destroy().catch(() => {});
    if (/password/i.test(err?.message ?? '')) {
      throw new PdfError('Die PDF-Datei ist passwortgeschützt.', 'Bitte eine Fassung ohne Passwort ablegen.');
    }
    throw new PdfError(`Die PDF-Datei konnte nicht geöffnet werden: ${err?.message ?? 'unbekannter Fehler'}`);
  }
}

/**
 * Rendert alle Seiten eines PDFs.
 *
 * Jede Seite wird genau einmal gezeichnet — in der größten benötigten
 * Breite. Alle kleineren Fassungen entstehen daraus durch Verkleinern,
 * was schneller und in der Qualität besser ist als erneutes Rendern.
 *
 * @param {string} file
 * @param {object} options
 * @param {number} options.renderWidth  Breite in Bildpunkten
 * @param {number} [options.onlyPage]   Nur diese eine Seite zeichnen
 * @param {(page:{index:number,width:number,height:number,png:Buffer,text:string})=>Promise<void>} onPage
 */
export async function renderPdf(file, { renderWidth, onlyPage = null }, onPage) {
  const { document, task } = await openDocument(file);
  const factory = new NodeCanvasFactory();
  const pages = [];

  if (onlyPage !== null && (onlyPage < 1 || onlyPage > document.numPages)) {
    await task.destroy().catch(() => {});
    throw new PdfError(
      `Die PDF-Datei hat keine Seite ${onlyPage} (sie hat ${document.numPages}).`,
      'Prüfe die Angabe "cover.page" in flyer.md.',
    );
  }

  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      if (onlyPage !== null && index !== onlyPage) continue;
      const page = await document.getPage(index);
      try {
        const natural = page.getViewport({ scale: 1 });
        // Kleine Seiten nicht künstlich hochrechnen.
        const scale = Math.min(renderWidth / natural.width, 4);
        const viewport = page.getViewport({ scale });

        const entry = factory.create(viewport.width, viewport.height);
        // Weißer Grund: PDF-Seiten sind oft transparent, sonst entstehen
        // schwarze Flächen beim Umwandeln nach WebP.
        entry.context.fillStyle = '#ffffff';
        entry.context.fillRect(0, 0, entry.canvas.width, entry.canvas.height);

        await page.render({
          canvas: entry.canvas,
          canvasContext: entry.context,
          viewport,
        }).promise;

        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ''))
          .join('')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .normalize('NFC');

        const result = {
          index,
          width: entry.canvas.width,
          height: entry.canvas.height,
          naturalWidth: natural.width,
          naturalHeight: natural.height,
          png: entry.canvas.toBuffer('image/png'),
          text,
        };
        pages.push({
          index,
          width: result.width,
          height: result.height,
          naturalWidth: natural.width,
          naturalHeight: natural.height,
          text,
        });

        await onPage(result);
        factory.destroy(entry);
      } finally {
        // Ohne cleanup() hält pdfjs Schrift- und Bilddaten jeder Seite fest.
        page.cleanup();
      }
    }
  } finally {
    await task.destroy().catch(() => {});
  }

  return pages;
}

/**
 * Zeichnet genau eine Seite und liefert sie als PNG.
 * Wird für Titelbilder gebraucht, deren Vorlage nicht die erste Seite ist.
 */
export async function renderPdfPage(file, { renderWidth, page }) {
  let png = null;
  await renderPdf(file, { renderWidth, onlyPage: page }, async (rendered) => {
    png = rendered.png;
  });
  if (!png) {
    throw new PdfError(`Die Seite ${page} konnte nicht gezeichnet werden.`);
  }
  return png;
}
