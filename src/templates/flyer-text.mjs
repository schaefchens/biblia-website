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
  const texts = ctx.media?.text(flyer, lang) ?? [];
  const canonical = ctx.textUrl(flyer, lang);

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
        ${texts.map((text, index) =>
          text
            ? html`
                <section class="flyer-text__page">
                  <h2 class="flyer-text__heading">
                    ${t('reader.pageOf', { current: index + 1, total: texts.length })}
                  </h2>
                  ${text
                    .split(/\n{2,}/)
                    .map((paragraph) => html`<p>${paragraph.replace(/\n/g, ' ')}</p>`)}
                </section>
              `
            : null,
        )}
      </div>

      <p class="notice">${t('flyer.textNotice')}</p>
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
