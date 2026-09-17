import { html } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';

/**
 * "Als Text lesen".
 *
 * Der beim Build aus dem PDF gelesene Text. Diese Seite hat zwei Aufgaben:
 * sie macht den Flyer mit einem Screenreader zugänglich, und sie ist die
 * Fassung, die Suchmaschinen tatsächlich auswerten können — die
 * Leseansicht besteht nur aus Bildern.
 */
export function flyerTextPage(ctx, flyer, lang) {
  const t = ctx.t(lang);
  const entry = flyer.languages[lang];
  // Aus gescannten PDFs lässt sich kein Text auslesen. Dann gilt die von
  // Hand hinterlegte Fassung aus flyer.<sprache>.txt.
  const manual = ctx.media?.manualText(flyer, lang) ?? null;
  const texts = manual ? [] : (ctx.media?.text(flyer, lang) ?? []);
  const hasText = Boolean(manual) || texts.some(Boolean);
  const canonical = ctx.textUrl(flyer, lang);

  const paragraphs = (text) =>
    text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => html`<p>${paragraph.replace(/\n/g, ' ')}</p>`);

  const main = html`
    <div class="page page--text">
      <header class="list-header">
        <p class="feature__label">
          <a href="${ctx.flyerUrl(flyer, lang)}">${entry.title}</a>
        </p>
        <h1>${t('action.readAsText')}</h1>
        <p class="hero__intro">${entry.description}</p>
        <div class="button-row" style="margin-top: var(--space-5)">
          <a class="button" href="${ctx.readUrl(flyer, lang)}">${t('action.read')}</a>
          <a class="button button--secondary" href="${ctx.flyerUrl(flyer, lang)}">${t('action.back')}</a>
        </div>
      </header>

      <div class="flyer-text">
        ${manual ? html`<section class="flyer-text__page">${paragraphs(manual)}</section>` : null}
        ${texts.map((text, index) =>
          text
            ? html`
                <section class="flyer-text__page">
                  <h2 class="flyer-text__heading">
                    ${t('reader.pageOf', { current: index + 1, total: texts.length })}
                  </h2>
                  ${paragraphs(text)}
                </section>
              `
            : null,
        )}
      </div>

      ${hasText
        ? html`<p class="notice">${manual ? t('flyer.textManual') : t('flyer.textNotice')}</p>`
        : html`<p class="notice">${t('flyer.textEmpty')}</p>`}
    </div>
  `;

  return layout(ctx, {
    lang,
    title: `${entry.title} — ${t('action.readAsText')}`,
    description: ctx.metaDescription(flyer, lang),
    canonical,
    alternates: ctx.altsForFlyer(flyer, 'text'),
    current: 'flyers',
    main,
  });
}
