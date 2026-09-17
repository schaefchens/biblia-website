/**
 * Bildableitungen aus den gerenderten PDF-Seiten.
 *
 * Aus einem großen PNG entstehen mehrere Breiten in WebP und AVIF sowie
 * ein winziges Vorschaubild, das direkt im HTML steht und die Fläche
 * füllt, bis das richtige Bild geladen ist.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { shortHash } from './emit.mjs';

/** sharp soll bei vielen Bildern nicht den ganzen Rechner belegen. */
sharp.concurrency(Math.max(1, Math.min(4, (await import('node:os')).availableParallelism?.() ?? 4)));
sharp.cache({ memory: 128 });

/**
 * Erzeugt alle Fassungen eines Bildes.
 *
 * @param {Buffer} source     Das gerenderte PNG
 * @param {object} options
 * @param {string} options.dir        Zielverzeichnis
 * @param {string} options.name       Dateiname ohne Endung, z. B. "page-01"
 * @param {number[]} options.widths   Gewünschte Breiten
 * @param {string[]} options.formats  z. B. ["webp", "avif"]
 * @param {object} options.quality
 * @param {object} [options.crop]     Anteiliger Ausschnitt { x, y, width, height }
 * @param {number} [options.lqipWidth]
 */
export async function createDerivatives(source, options) {
  const { dir, name, widths, formats, quality, crop = null, lqipWidth = 16 } = options;

  let image = sharp(source, { limitInputPixels: 400_000_000 });
  const metadata = await image.metadata();

  let baseWidth = metadata.width;
  let baseHeight = metadata.height;

  if (crop) {
    const left = Math.round(metadata.width * crop.x);
    const top = Math.round(metadata.height * crop.y);
    const width = Math.max(1, Math.round(metadata.width * crop.width));
    const height = Math.max(1, Math.round(metadata.height * crop.height));
    image = image.extract({
      left: Math.min(left, metadata.width - 1),
      top: Math.min(top, metadata.height - 1),
      width: Math.min(width, metadata.width - left),
      height: Math.min(height, metadata.height - top),
    });
    baseWidth = width;
    baseHeight = height;
  }

  // Nur Breiten erzeugen, die kleiner sind als das Original — ein
  // hochskaliertes Bild wäre größer bei schlechterer Qualität.
  const usable = widths.filter((w) => w <= baseWidth);
  if (usable.length === 0) usable.push(baseWidth);
  const targets = [...new Set(usable)].sort((a, b) => a - b);

  const buffer = await image.toBuffer();
  const sources = {};

  for (const format of formats) {
    sources[format] = [];
    for (const width of targets) {
      const resized = sharp(buffer).resize({ width, withoutEnlargement: true, kernel: 'lanczos3' });
      const encoded =
        format === 'avif'
          ? await resized.avif({ quality: quality.avif, effort: 4 }).toBuffer()
          : await resized.webp({ quality: quality.webp, effort: 4 }).toBuffer();

      const file = `${name}-${width}.${shortHash(encoded)}.${format}`;
      fs.writeFileSync(path.join(dir, file), encoded);
      sources[format].push({ width, file, bytes: encoded.length });
    }
  }

  // Winziges Vorschaubild als Data-URL. Klein genug, um direkt im HTML
  // zu stehen, und dadurch ohne zusätzliche Anfrage sofort da.
  const lqip = await sharp(buffer)
    .resize({ width: lqipWidth })
    .webp({ quality: 40, alphaQuality: 0, smartSubsample: true })
    .toBuffer();

  return {
    width: baseWidth,
    height: baseHeight,
    aspect: `${baseWidth} / ${baseHeight}`,
    sources,
    placeholder: `data:image/webp;base64,${lqip.toString('base64')}`,
  };
}
