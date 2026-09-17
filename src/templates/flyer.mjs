import { html, attrs } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { flyerGrid } from '../components/flyer-card.mjs';

/** Preisangabe: kostenlos oder Kostenbeitrag. */
function priceLabel(ctx, flyer, lang) {
  const t = ctx.t(lang);
  if (!flyer.order.enabled) return null;
  if (flyer.order.price <= 0) return t('flyer.printFree');
  const price = new Intl.NumberFormat(ctx.htmlLang(lang), {
    style: 'currency',
    currency: flyer.order.currency,
  }).format(flyer.order.price);
  return t('flyer.printContribution', { price });
}

/**
 * Detailseite eines Flyers.
 *
 * Reihenfolge der Handlungen nach Wichtigkeit: Lesen, Teilen, Bestellen.
 */
export function flyerPage(ctx, flyer, lang, options = {}) {
  const { selfPath = null, banner = null } = options;
  const t = ctx.t(lang);
  const entry = flyer.languages[lang];
  const description = ctx.metaDescription(flyer, lang);
  const related = ctx.relatedFlyers(flyer, lang, 4);
  const canonical = ctx.flyerUrl(flyer, lang);
  const price = priceLabel(ctx, flyer, lang);

  const topics = flyer.topics
    .map((slug) => ({ slug, title: ctx.topicTitle(slug, lang) }))
    .filter((topic) => topic.title);
  const categoryTitle = ctx.categoryTitle(flyer.category, lang);

  const otherLanguages = ctx
    .flyerLanguages(flyer)
    .filter((code) => code !== lang)
    .map((code) => ctx.languageLabel(code));

  const main = html`
    <div class="page">
      <article class="flyer">
        <div class="flyer__top">
          <div class="flyer__cover">
            ${ctx.media?.coverImage(ctx, flyer, lang, { eager: true, className: 'flyer__cover-image' }) ??
            html`<span class="card__placeholder">${entry.title}</span>`}
          </div>

          <div class="flyer__intro">
            ${categoryTitle
              ? html`<p class="feature__label">
                  <a href="${ctx.categoryUrl(flyer.category, lang)}">${categoryTitle}</a>
                </p>`
              : null}

            <h1>${entry.title}</h1>

            ${entry.description ? html`<p class="flyer__lead">${entry.description}</p>` : null}

            <div class="button-row flyer__actions">
              <a class="button button--large" href="${ctx.readUrl(flyer, lang)}">${t('action.read')}</a>
              <button
                class="button button--secondary button--large"
                type="button"
                data-share
                data-share-title="${entry.title}"
                data-share-text="${entry.description || entry.title}"
                data-share-url="${ctx.permalink(flyer)}"
                data-share-qr="${ctx.media?.qrUrl(flyer, lang) ?? ''}"
                data-label-share="${t('action.share')}"
                data-label-whatsapp="${t('action.shareWhatsapp')}"
                data-label-copy="${t('action.copyLink')}"
                data-label-copied="${t('action.copied')}"
                data-label-qr="${t('action.showQr')}"
                hidden
              >
                ${t('action.share')}
              </button>
              ${flyer.order.enabled
                ? html`<button
                    class="button button--secondary button--large"
                    type="button"
                    data-select-flyer="${flyer.id}"
                    data-select-title="${entry.title}"
                    data-select-slug="${flyer.slug}"
                data-select-added="${t('action.inSelection')}"
                  >
                    ${t('action.order')}
                  </button>`
                : null}
            </div>

            <p class="flyer__facts">
              ${[
                ctx.media?.pageCount(flyer, lang)
                  ? t.plural('flyer.pages', ctx.media.pageCount(flyer, lang))
                  : null,
                price,
                otherLanguages.length > 0
                  ? t('language.available', { languages: otherLanguages.join(', ') })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            ${flyer.status === 'archived'
              ? html`<p class="notice">${t('flyer.archived')}</p>`
              : null}
            ${entry.pdfLanguage && entry.pdfLanguage !== lang
              ? html`<p class="notice">
                  ${t('flyer.pdfFromLanguage', { language: ctx.languageLabel(entry.pdfLanguage) })}
                </p>`
              : null}
          </div>
        </div>

        ${flyer.bibleRefs.length > 0 || entry.body
          ? html`
              <div class="flyer__body page--text">
                ${entry.bodyHtml ? html`<div class="prose">${entry.bodyHtml}</div>` : null}
                ${flyer.bibleRefs.length > 0
                  ? html`<p class="flyer__refs">
                      <span class="settings__label">${t('flyer.verse')}:</span>
                      ${flyer.bibleRefs.join(' · ')}
                    </p>`
                  : null}
              </div>
            `
          : null}

        <div class="flyer__secondary">
          <div class="button-row">
            <a class="button button--quiet" href="${ctx.textUrl(flyer, lang)}"
              >${t('action.readAsText')}</a
            >
            ${flyer.download && ctx.media?.downloadUrl(flyer, lang)
              ? html`<a
                  class="button button--quiet"
                  href="${ctx.media.downloadUrl(flyer, lang)}"
                  ${attrs({ download: `${flyer.slug}.pdf` })}
                  >${t('action.download')}</a
                >`
              : null}
          </div>
        </div>

        ${topics.length > 0
          ? html`
              <section class="section" aria-labelledby="flyer-themen">
                <div class="section__head">
                  <h2 class="section__title" id="flyer-themen">${t('flyer.topics')}</h2>
                </div>
                <ul class="tag-list">
                  ${topics.map(
                    (topic) => html`
                      <li><a class="tag" href="${ctx.topicUrl(topic.slug, lang)}">${topic.title}</a></li>
                    `,
                  )}
                </ul>
              </section>
            `
          : null}

        ${related.length > 0
          ? html`
              <section class="section" aria-labelledby="verwandt">
                <div class="section__head">
                  <h2 class="section__title" id="verwandt">${t('flyer.related')}</h2>
                </div>
                ${flyerGrid(ctx, related, lang)}
              </section>
            `
          : null}
      </article>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: entry.title,
    description,
    canonical,
    alternates: ctx.altsForFlyer(flyer),
    image: ctx.media?.shareImage(flyer, lang),
    current: 'flyers',
    noindex: flyer.status === 'archived',
    // Die Kurzadresse zeigt denselben Inhalt. Maßgeblich bleibt die
    // Sprachfassung; geteilt wird aber die Kurzadresse.
    ogUrl: selfPath,
    banner,
    main,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: entry.title,
      description,
      inLanguage: lang,
      url: `${ctx.config.origin}${canonical}`,
      identifier: String(flyer.id),
      publisher: { '@type': 'Organization', name: ctx.config.organization?.name ?? ctx.config.siteName },
      ...(flyer.date ? { datePublished: flyer.date } : {}),
      ...(topics.length > 0 ? { about: topics.map((topic) => topic.title) } : {}),
    },
  });
}
