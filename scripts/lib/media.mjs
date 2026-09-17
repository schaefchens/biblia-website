/**
 * Medien-Pipeline: aus PDF-Dateien werden alle Bilder der Website.
 *
 * Jeder Schritt hat einen eigenen Eintrag im Zwischenspeicher mit einem
 * eigenen Schlüssel. Dadurch führt eine Titeländerung nur dazu, dass die
 * Bilder zum Teilen neu entstehen — die aufwendig gerenderten Seiten
 * bleiben unberührt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR } from './paths.mjs';
import { Cache, hashFile } from './cache.mjs';
import { renderPdf, PdfError } from './pdf.mjs';
import { createDerivatives } from './images.mjs';
import { createSocialImages, SOCIAL_TEMPLATE_VERSION } from './social.mjs';
import { html, attrs } from './html.mjs';

/** Zweistellige Seitennummer für stabile Dateinamen. */
const pageName = (index) => `page-${String(index).padStart(2, '0')}`;

/** srcset-Zeichenkette aus den erzeugten Breiten. */
function buildSrcset(sources, baseUrl) {
  return sources.map((entry) => `${baseUrl}/${entry.file} ${entry.width}w`).join(', ');
}

/**
 * Baut alle Medien und liefert ein Objekt, das die Vorlagen benutzen.
 *
 * @param {object} options
 * @param {object} options.config
 * @param {object} options.content
 * @param {object} options.i18n
 * @param {import('./emit.mjs').Emitter} options.emitter
 * @param {boolean} [options.force]  Zwischenspeicher übergehen
 * @param {(text:string)=>void} [options.onProgress]
 */
export async function buildMedia({ config, content, i18n, emitter, force = false, onProgress }) {
  const cache = new Cache(DIR.cache, { disabled: force });
  const { images, share: shareConfig } = config;
  const byFlyer = new Map();
  const issues = [];
  let renderedPages = 0;

  for (const flyer of content.flyers) {
    for (const langCode of Object.keys(flyer.languages)) {
      const entry = flyer.languages[langCode];
      if (!entry.pdf) continue;

      // Liegt für diese Sprache kein eigenes PDF vor, wird das der
      // Standardsprache verwendet. Dann sind auch die Bilder dieselben.
      const isOwnPdf = entry.hasOwnPdf;
      const pdfLang = entry.pdfLanguage ?? langCode;
      const key = `${flyer.id}:${langCode}`;

      if (!isOwnPdf) {
        const shared = byFlyer.get(`${flyer.id}:${pdfLang}`);
        if (shared) {
          // Seiten und Cover teilen, Teilen-Bilder aber sprachabhängig neu
          // erzeugen — sie enthalten Titel und Aufforderungstext.
          byFlyer.set(key, { ...shared, borrowedFrom: pdfLang });
        }
      }

      const pdfHash = hashFile(entry.pdf);
      const mediaBase = `media/${flyer.id}/${pdfLang}`;

      // ---- Seiten rendern ----
      let pageResult;
      try {
        pageResult = await cache.use(
          {
            step: 'pages',
            pdf: pdfHash,
            renderWidth: images.renderWidth,
            widths: images.readerWidths,
            formats: images.formats,
            quality: images.quality,
            lqip: images.lqipWidth,
          },
          async (workDir) => {
            onProgress?.(`${flyer.dirName} (${pdfLang.toUpperCase()})`);
            const pages = [];
            await renderPdf(entry.pdf, { renderWidth: images.renderWidth }, async (page) => {
              const derived = await createDerivatives(page.png, {
                dir: workDir,
                name: pageName(page.index),
                widths: images.readerWidths,
                formats: images.formats,
                quality: images.quality,
                lqipWidth: images.lqipWidth,
              });
              // Das große PNG der ersten Seite wird für Cover und
              // Teilen-Bilder noch gebraucht.
              if (page.index === 1) fs.writeFileSync(path.join(workDir, 'page-01-full.png'), page.png);
              pages.push({ index: page.index, text: page.text, ...derived });
              renderedPages += 1;
            });
            return { pages, pageCount: pages.length };
          },
        );
      } catch (err) {
        if (err instanceof PdfError) {
          issues.push({
            subject: flyer.dirName,
            message: `${pdfLang.toUpperCase()}: ${err.message}`,
            hint: err.hint,
            file: entry.pdf,
          });
          continue;
        }
        throw err;
      }

      const pagesMeta = pageResult.meta;
      const sourcePng = path.join(pageResult.dir, 'page-01-full.png');

      // ---- Cover ----
      const coverPageIndex = Math.min(flyer.cover.page, pagesMeta.pageCount);
      const coverSourcePng =
        coverPageIndex === 1
          ? sourcePng
          : null; // andere Seiten als Cover: aus der gerenderten Fassung ableiten

      const coverResult = await cache.use(
        {
          step: 'cover',
          pdf: pdfHash,
          page: coverPageIndex,
          crop: flyer.cover.crop,
          widths: images.coverWidths,
          formats: images.formats,
          quality: images.quality,
          renderWidth: images.renderWidth,
        },
        async (workDir) => {
          const source = coverSourcePng ?? sourcePng;
          const derived = await createDerivatives(fs.readFileSync(source), {
            dir: workDir,
            name: 'cover',
            widths: images.coverWidths,
            formats: images.formats,
            quality: images.quality,
            crop: flyer.cover.crop,
            lqipWidth: images.lqipWidth,
          });
          // Große Fassung für die Bilder zum Teilen.
          const full = await createDerivatives(fs.readFileSync(source), {
            dir: workDir,
            name: 'cover-full',
            widths: [1200],
            formats: ['webp'],
            quality: { webp: 92, avif: 70 },
            crop: flyer.cover.crop,
            lqipWidth: images.lqipWidth,
          });
          return { ...derived, fullFile: full.sources.webp[0].file };
        },
      );

      // ---- Bilder zum Teilen (sprachabhängig) ----
      const t = i18n.for(langCode);
      const callToAction = t('social.callToAction');
      const permanentUrl = config.urls.abs(
        config.urls.stripBase(config.urls.short('flyer', flyer.id)).slice(1),
      );

      const socialResult = await cache.use(
        {
          step: 'social',
          template: SOCIAL_TEMPLATE_VERSION,
          cover: coverResult.meta.fullFile,
          title: entry.title,
          callToAction,
          siteName: config.siteName,
          url: permanentUrl,
          shareSize: shareConfig.imageSize,
          statusSize: shareConfig.statusSize,
        },
        async (workDir) =>
          createSocialImages({
            dir: workDir,
            coverPng: fs.readFileSync(path.join(coverResult.dir, coverResult.meta.fullFile)),
            title: entry.title,
            callToAction,
            siteName: config.siteName,
            url: permanentUrl,
            shareSize: shareConfig.imageSize,
            statusSize: shareConfig.statusSize,
          }),
      );

      // ---- Dateien in die Website übernehmen ----
      const socialBase = `media/${flyer.id}/${langCode}`;

      for (const page of pagesMeta.pages) {
        for (const format of Object.keys(page.sources)) {
          for (const variant of page.sources[format]) {
            emitter.copy(`${mediaBase}/${variant.file}`, path.join(pageResult.dir, variant.file));
          }
        }
      }
      for (const format of Object.keys(coverResult.meta.sources)) {
        for (const variant of coverResult.meta.sources[format]) {
          emitter.copy(`${mediaBase}/${variant.file}`, path.join(coverResult.dir, variant.file));
        }
      }
      emitter.copy(`${socialBase}/${socialResult.meta.share.file}`, path.join(socialResult.dir, socialResult.meta.share.file));
      emitter.copy(`${socialBase}/${socialResult.meta.status.file}`, path.join(socialResult.dir, socialResult.meta.status.file));
      emitter.copy(`${socialBase}/${socialResult.meta.qr.web}`, path.join(socialResult.dir, socialResult.meta.qr.web));

      // QR-Code für den Druck wird NICHT mit hochgeladen, sondern liegt
      // lokal für die Gestaltung bereit.
      const printDir = path.join(DIR.printAssets, `${flyer.id}-${flyer.slug}`);
      fs.mkdirSync(printDir, { recursive: true });
      const printQr = fs.readFileSync(path.join(socialResult.dir, socialResult.meta.qr.print), 'utf8');
      fs.writeFileSync(
        path.join(printDir, `qr-${langCode}.svg`),
        config.isStaging ? markAsTestOnly(printQr, permanentUrl) : printQr,
      );

      // Druckausgabe zum Herunterladen, wenn im Flyer freigegeben.
      let downloadUrl = null;
      if (flyer.download && entry.hasOwnPdf) {
        const target = `${mediaBase}/${flyer.slug}-${langCode}.pdf`;
        if (!emitter.files.has(target)) emitter.copy(target, entry.pdf);
        downloadUrl = config.urls.file(target);
      }

      byFlyer.set(key, {
        pageCount: pagesMeta.pageCount,
        pages: pagesMeta.pages.map((page) => ({
          index: page.index,
          width: page.width,
          height: page.height,
          aspect: page.aspect,
          placeholder: page.placeholder,
          sources: page.sources,
          baseUrl: config.urls.file(mediaBase),
          text: page.text,
        })),
        cover: {
          width: coverResult.meta.width,
          height: coverResult.meta.height,
          aspect: coverResult.meta.aspect,
          placeholder: coverResult.meta.placeholder,
          sources: coverResult.meta.sources,
          baseUrl: config.urls.file(mediaBase),
        },
        share: {
          url: config.urls.file(`${socialBase}/${socialResult.meta.share.file}`),
          ...shareConfig.imageSize,
        },
        status: {
          url: config.urls.file(`${socialBase}/${socialResult.meta.status.file}`),
          ...shareConfig.statusSize,
        },
        qr: config.urls.file(`${socialBase}/${socialResult.meta.qr.web}`),
        download: downloadUrl,
        permanentUrl,
      });
    }
  }

  const removed = cache.collectGarbage();

  return {
    manifest: byFlyer,
    issues,
    stats: {
      hits: cache.hits,
      misses: cache.misses,
      renderedPages,
      cacheRemoved: removed,
    },
    ...createMediaHelpers(byFlyer, config),
  };
}

/** Kennzeichnet einen Druck-QR-Code, der noch auf eine Testadresse zeigt. */
function markAsTestOnly(svg, url) {
  const banner = `<!-- NICHT DRUCKEN: Dieser QR-Code zeigt auf eine Testadresse (${url}).
     Sobald die endgültige Domain in config/site.json eingetragen ist, wird er beim
     nächsten Build neu erzeugt. Gedruckte QR-Codes lassen sich nicht mehr ändern. -->\n`;
  return banner + svg;
}

/** Die Funktionen, die den Vorlagen zur Verfügung stehen. */
function createMediaHelpers(byFlyer, config) {
  const get = (flyer, lang) => byFlyer.get(`${flyer.id}:${lang}`) ?? null;

  /** Baut die Angaben für ein <img>-Element. */
  const imageAttributes = (entry, sizes) => {
    if (!entry) return null;
    const webp = entry.sources.webp ?? [];
    const largest = webp[webp.length - 1];
    if (!largest) return null;
    return {
      src: `${entry.baseUrl}/${largest.file}`,
      srcset: buildSrcset(webp, entry.baseUrl),
      avif: entry.sources.avif ? buildSrcset(entry.sources.avif, entry.baseUrl) : null,
      sizes,
      width: entry.width,
      height: entry.height,
      aspect: entry.aspect,
      placeholder: entry.placeholder,
    };
  };

  return {
    /** Seitenzahl eines Flyers. */
    pageCount(flyer, lang) {
      return get(flyer, lang)?.pageCount ?? null;
    },

    /** Angaben für das Cover. */
    cover(flyer, lang, sizes = '(max-width: 30rem) 45vw, (max-width: 60rem) 30vw, 300px') {
      const media = get(flyer, lang);
      return media ? imageAttributes(media.cover, sizes) : null;
    },

    /** Fertiges Cover-Bild als HTML, mit AVIF-Alternative. */
    coverImage(ctx, flyer, lang, { eager = false, className = 'card__image', sizes } = {}) {
      const image = this.cover(flyer, lang, sizes);
      if (!image) return null;
      const t = ctx.t(lang);
      const alt = t('flyer.cover', { title: flyer.languages[lang].title });
      return pictureElement(image, { alt, className, eager });
    },

    /** Alle Seiten für die Leseansicht. */
    pages(flyer, lang) {
      return get(flyer, lang)?.pages ?? [];
    },

    /** Eine Seite als Bildangaben. */
    page(flyer, lang, index, sizes = '(max-width: 60rem) 100vw, 60rem') {
      const media = get(flyer, lang);
      const page = media?.pages.find((p) => p.index === index);
      return page ? imageAttributes(page, sizes) : null;
    },

    /** Bild für Vorschauen beim Teilen. */
    shareImage(flyer, lang) {
      const media = get(flyer, lang);
      if (!media) return null;
      const entry = flyer.languages[lang];
      return { ...media.share, alt: entry?.title ?? '' };
    },

    /** Hochformatiges Bild für Status-Beiträge. */
    statusImage(flyer, lang) {
      return get(flyer, lang)?.status ?? null;
    },

    /** QR-Code fürs Web. */
    qrUrl(flyer, lang) {
      return get(flyer, lang)?.qr ?? null;
    },

    /** Adresse der Druckausgabe, sofern freigegeben. */
    downloadUrl(flyer, lang) {
      return get(flyer, lang)?.download ?? null;
    },

    /** Der aus dem PDF gelesene Text, seitenweise. */
    text(flyer, lang) {
      return (get(flyer, lang)?.pages ?? []).map((page) => page.text);
    },

    raw: get,
  };
}

/** <picture> mit AVIF und WebP. */
export function pictureElement(image, { alt, className, eager = false }) {
  return html`
    <picture>
      ${image.avif ? html`<source type="image/avif" srcset="${image.avif}" sizes="${image.sizes}" />` : null}
      <img
        class="${className}"
        src="${image.src}"
        srcset="${image.srcset}"
        sizes="${image.sizes}"
        ${attrs({
          width: image.width,
          height: image.height,
          loading: eager ? null : 'lazy',
          decoding: eager ? null : 'async',
          fetchpriority: eager ? 'high' : null,
          alt,
        })}
      />
    </picture>
  `;
}
