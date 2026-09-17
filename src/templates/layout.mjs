import { html, attrs, render, raw, jsonScript } from '../../scripts/lib/html.mjs';
import { header } from '../components/header.mjs';
import { footer } from '../components/footer.mjs';
import { THEME_BOOTSTRAP } from './theme-bootstrap.mjs';

/**
 * Gemeinsames Gerüst aller Seiten.
 *
 * Der gesamte Inhalt steht bereits im ausgelieferten HTML. JavaScript
 * verbessert die Bedienung, wird aber zum Lesen nie gebraucht.
 *
 * @param {object} ctx      Render-Kontext
 * @param {object} page
 * @param {string} page.lang
 * @param {string} page.title         Seitentitel (ohne Websitename)
 * @param {string} page.description   Beschreibung für Suchmaschinen und zum Teilen
 * @param {string} page.canonical     Pfad dieser Seite
 * @param {Array}  page.alternates    [{ lang, href }] für hreflang
 * @param {object} [page.image]       { url, width, height, alt } für OpenGraph
 * @param {*}      page.main          Inhalt
 * @param {string} [page.current]     Aktiver Navigationspunkt
 * @param {boolean}[page.noindex]     Seite von der Indexierung ausnehmen
 * @param {boolean}[page.bare]        Ohne Kopf- und Fußzeile (Leseansicht)
 * @param {object} [page.jsonLd]      Strukturierte Daten
 * @param {*}      [page.head]        Zusätzliche Angaben im <head>
 * @param {string} [page.ogUrl]       Abweichende Adresse für OpenGraph (Kurzadressen)
 * @param {*}      [page.banner]      Hinweis über dem Inhalt (Sprachwahl)
 */
export function layout(ctx, page) {
  const {
    lang,
    title,
    description = '',
    canonical,
    alternates = [],
    image = null,
    main,
    current = null,
    noindex = false,
    bare = false,
    jsonLd = null,
    head = null,
    bodyClass = null,
    ogUrl = null,
    banner = null,
  } = page;

  const { config, urls } = ctx;
  const t = ctx.t(lang);
  const fullTitle = title ? `${title} — ${config.siteName}` : config.siteName;
  const canonicalUrl = `${config.origin}${canonical}`;
  // Beim Teilen zählt die Adresse, die tatsächlich verschickt wurde.
  const shareUrl = ogUrl ? `${config.origin}${ogUrl}` : canonicalUrl;

  // Auf einer Testadresse darf nichts in den Suchindex geraten. robots.txt
  // greift in einem Unterverzeichnis nicht, deshalb hier zusätzlich als
  // Meta-Angabe (und in der .htaccess als Kopfzeile).
  const blockIndexing = noindex || config.isStaging;

  const alternateLinks = alternates.filter((alt) => config.hasLanguage(alt.lang));
  const defaultAlternate =
    alternateLinks.find((alt) => alt.lang === config.defaultLanguage) ?? alternateLinks[0];

  return raw(`<!doctype html>\n${render(html`
    <html lang="${ctx.htmlLang(lang)}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>${fullTitle}</title>
        ${description ? html`<meta name="description" content="${description}" />` : null}
        <link rel="canonical" href="${canonicalUrl}" />
        ${blockIndexing ? html`<meta name="robots" content="noindex, nofollow" />` : null}

        ${alternateLinks.map(
          (alt) =>
            html`<link rel="alternate" hreflang="${alt.lang}" href="${config.origin}${alt.href}" />`,
        )}
        ${defaultAlternate
          ? html`<link
              rel="alternate"
              hreflang="x-default"
              href="${config.origin}${defaultAlternate.href}"
            />`
          : null}

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="${config.siteName}" />
        <meta property="og:locale" content="${ctx.htmlLang(lang).replace('-', '_')}" />
        <meta property="og:title" content="${title || config.siteName}" />
        ${description ? html`<meta property="og:description" content="${description}" />` : null}
        <meta property="og:url" content="${shareUrl}" />
        ${image
          ? html`
              <meta property="og:image" content="${config.origin}${image.url}" />
              <meta property="og:image:width" content="${image.width}" />
              <meta property="og:image:height" content="${image.height}" />
              ${image.alt ? html`<meta property="og:image:alt" content="${image.alt}" />` : null}
              <meta name="twitter:card" content="summary_large_image" />
            `
          : html`<meta name="twitter:card" content="summary" />`}

        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf7f2" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#14110f" />

        ${ctx.assets.icons
          ? html`
              <link rel="icon" href="${ctx.assets.icons.svg}" type="image/svg+xml" />
              <link rel="icon" href="${ctx.assets.icons.png32}" sizes="32x32" type="image/png" />
              <link rel="apple-touch-icon" href="${ctx.assets.icons.appleTouch}" />
            `
          : null}

        <link rel="stylesheet" href="${ctx.assets.css}" />
        ${ctx.assets.preloadFonts?.map(
          (href) =>
            html`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin />`,
        )}

        <script>
          ${raw(THEME_BOOTSTRAP)}
        </script>

        ${jsonLd
          ? html`<script type="application/ld+json">
              ${jsonScript(jsonLd)}
            </script>`
          : null}
        ${head}
      </head>
      <body ${attrs({ class: bodyClass })}>
        ${bare
          ? main
          : html`
              <a class="skip-link" href="#inhalt">${t('site.skipToContent')}</a>
              ${header(ctx, { lang, current })}
              ${banner}
              <main id="inhalt">${main}</main>
              ${footer(ctx, { lang, alternates: alternateLinks })}
            `}
        <script type="module" src="${ctx.assets.js}"></script>
      </body>
    </html>
  `)}`);
}
