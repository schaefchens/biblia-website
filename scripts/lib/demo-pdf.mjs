/**
 * Erzeugt Beispiel-PDFs, die wie echte Flyer aussehen.
 *
 * Nur für die Entwicklung: damit lässt sich die gesamte Medien-Pipeline
 * prüfen, bevor echte Druckdaten vorliegen.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAPER = rgb(0.98, 0.969, 0.949); // #FAF7F2
const INK = rgb(0.110, 0.094, 0.090); // #1C1917
const ACCENT = rgb(0.659, 0.333, 0.227); // #A8553A
const MUTED = rgb(0.45, 0.42, 0.40);

const A5 = { width: 420, height: 595 };
const A4_LANDSCAPE = { width: 842, height: 595 };

/** Bricht Text auf eine Breite um. */
function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawParagraph(page, text, { font, size, x, y, maxWidth, color = INK, leading = 1.5 }) {
  let cursor = y;
  for (const line of wrap(text, font, size, maxWidth)) {
    if (line) page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size * leading;
  }
  return cursor;
}

/**
 * Baut ein Beispiel-PDF.
 * @param {object} spec
 * @param {string} spec.title
 * @param {string} spec.verse
 * @param {string} spec.verseRef
 * @param {string} spec.body
 * @param {number} spec.pages
 * @param {boolean} [spec.folded] Dreitafel-Faltflyer im Querformat
 */
export async function createDemoPdf(spec) {
  const doc = await PDFDocument.create();
  doc.setTitle(spec.title);
  doc.setAuthor('Biblia');
  doc.setSubject('Beispielinhalt');
  doc.setProducer('Biblia Demo');
  doc.setCreator('Biblia Demo');
  // Feste Zeitstempel: sonst ändert sich das PDF bei jedem Lauf und der
  // Zwischenspeicher der Medien-Pipeline wäre nie gültig.
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.setModificationDate(new Date('2026-01-01T00:00:00Z'));

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  return spec.folded
    ? buildFolded(doc, spec, { serif, serifBold, serifItalic, sans })
    : buildStandard(doc, spec, { serif, serifBold, serifItalic, sans });
}

function buildStandard(doc, spec, fonts) {
  const { serif, serifBold, serifItalic, sans } = fonts;
  const margin = 44;
  const textWidth = A5.width - margin * 2;

  for (let index = 0; index < spec.pages; index += 1) {
    const page = doc.addPage([A5.width, A5.height]);
    page.drawRectangle({ x: 0, y: 0, width: A5.width, height: A5.height, color: PAPER });

    if (index === 0) {
      // Titelseite
      const titleSize = spec.title.length > 16 ? 34 : 44;
      let y = A5.height - 150;
      for (const line of wrap(spec.title, serifBold, titleSize, textWidth)) {
        page.drawText(line, { x: margin, y, size: titleSize, font: serifBold, color: INK });
        y -= titleSize * 1.15;
      }
      page.drawLine({
        start: { x: margin, y: y - 6 },
        end: { x: margin + 64, y: y - 6 },
        thickness: 2,
        color: ACCENT,
      });
      if (spec.verse) {
        y = drawParagraph(page, `«${spec.verse}»`, {
          font: serifItalic, size: 13, x: margin, y: y - 44, maxWidth: textWidth, color: MUTED,
        });
        page.drawText(spec.verseRef ?? '', { x: margin, y: y - 4, size: 10, font: sans, color: ACCENT });
      }
      page.drawText('BIBLIA', { x: margin, y: 44, size: 11, font: sans, color: MUTED });
    } else {
      // Innenseite
      const heading = `${spec.title} · ${index + 1}`;
      page.drawText(heading, { x: margin, y: A5.height - 80, size: 16, font: serifBold, color: INK });
      page.drawLine({
        start: { x: margin, y: A5.height - 94 },
        end: { x: A5.width - margin, y: A5.height - 94 },
        thickness: 0.6,
        color: rgb(0.85, 0.83, 0.80),
      });
      drawParagraph(page, spec.body, {
        font: serif, size: 12, x: margin, y: A5.height - 130, maxWidth: textWidth, leading: 1.7,
      });
      page.drawText(String(index + 1), { x: A5.width - margin - 8, y: 40, size: 10, font: sans, color: MUTED });
    }
  }
  return doc.save();
}

/**
 * Gefalteter Dreitafel-Flyer.
 * Das Titelblatt ist das rechte Drittel — genau der Fall, für den es in
 * flyer.md die Angabe cover.crop gibt.
 */
function buildFolded(doc, spec, fonts) {
  const { serif, serifBold, serifItalic, sans } = fonts;
  const panel = A4_LANDSCAPE.width / 3;
  const margin = 30;
  const textWidth = panel - margin * 2;

  for (let index = 0; index < spec.pages; index += 1) {
    const page = doc.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height]);
    page.drawRectangle({ x: 0, y: 0, width: A4_LANDSCAPE.width, height: A4_LANDSCAPE.height, color: PAPER });

    // Falzlinien andeuten
    for (const x of [panel, panel * 2]) {
      page.drawLine({
        start: { x, y: 0 }, end: { x, y: A4_LANDSCAPE.height },
        thickness: 0.4, color: rgb(0.88, 0.86, 0.83), dashArray: [3, 4],
      });
    }

    if (index === 0) {
      // Rechtes Drittel = Titel
      const x = panel * 2 + margin;
      let y = A4_LANDSCAPE.height - 140;
      for (const line of wrap(spec.title, serifBold, 32, textWidth)) {
        page.drawText(line, { x, y, size: 32, font: serifBold, color: INK });
        y -= 32 * 1.15;
      }
      page.drawLine({ start: { x, y: y - 8 }, end: { x: x + 52, y: y - 8 }, thickness: 2, color: ACCENT });
      if (spec.verse) {
        drawParagraph(page, `«${spec.verse}»`, {
          font: serifItalic, size: 11, x, y: y - 40, maxWidth: textWidth, color: MUTED,
        });
      }
      page.drawText('BIBLIA', { x, y: 40, size: 10, font: sans, color: MUTED });

      // Mittleres und linkes Drittel: Rückseite und Innenteil
      drawParagraph(page, spec.body, {
        font: serif, size: 10.5, x: panel + margin, y: A4_LANDSCAPE.height - 150, maxWidth: textWidth, leading: 1.7,
      });
    } else {
      for (let p = 0; p < 3; p += 1) {
        const x = panel * p + margin;
        page.drawText(`${spec.title} · ${p + 1}`, {
          x, y: A4_LANDSCAPE.height - 80, size: 13, font: serifBold, color: INK,
        });
        drawParagraph(page, spec.body, {
          font: serif, size: 10.5, x, y: A4_LANDSCAPE.height - 110, maxWidth: textWidth, leading: 1.7,
        });
      }
    }
  }
  return doc.save();
}
