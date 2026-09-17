import { html } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { flyerGrid, flyerCard } from '../components/flyer-card.mjs';

/**
 * Startseite.
 *
 * Kein endloses Raster, sondern kuratierte Abschnitte: ein Aufmacher,
 * ein hervorgehobener Flyer, ausgewählte Flyer, Themen, Neuerscheinungen.
 */
export function homePage(ctx, lang, options = {}) {
  const { selfPath = null, banner = null } = options;
  const t = ctx.t(lang);
  const page = ctx.content.pages.get('home')?.languages[lang] ?? {};

  const published = ctx.content.published(lang);
  const featured = ctx.featuredFlyers(lang, 7);
  const lead = featured[0] ?? published[0] ?? null;
  const selected = featured.filter((flyer) => flyer.id !== lead?.id).slice(0, 4);
  const latest = published.filter((flyer) => flyer.id !== lead?.id).slice(0, 4);

  const topics = [...ctx.content.topics.values()]
    .filter((topic) => topic.languages[lang] && topic.flyers.some((f) => f.languages[lang]))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.slug.localeCompare(b.slug))
    .slice(0, 12);

  const leadEntry = lead?.languages[lang];

  const main = html`
    <div class="page">
      <section class="hero">
        <h1 class="hero__title">${page.headline || ctx.config.tagline?.[lang] || ctx.config.siteName}</h1>
        ${page.intro ? html`<p class="hero__intro">${page.intro}</p>` : null}
        <div class="hero__actions button-row">
          <a class="button button--large" href="${ctx.archiveUrl(lang)}">${t('action.allFlyers')}</a>
          <a class="button button--secondary button--large" href="${ctx.topicsUrl(lang)}"
            >${t('nav.topics')}</a
          >
        </div>
      </section>

      ${lead && leadEntry
        ? html`
            <section class="section" aria-labelledby="aufmacher">
              <div class="feature">
                <a class="feature__media" href="${ctx.flyerUrl(lead, lang)}" tabindex="-1" aria-hidden="true">
                  ${ctx.media?.coverImage(ctx, lead, lang, { eager: true, className: 'card__image' }) ??
                  html`<span class="card__placeholder">${leadEntry.title}</span>`}
                </a>
                <div>
                  <p class="feature__label">${t('home.featured')}</p>
                  <h2 class="feature__title" id="aufmacher">
                    <a href="${ctx.flyerUrl(lead, lang)}">${leadEntry.title}</a>
                  </h2>
                  ${leadEntry.description
                    ? html`<p class="feature__text">${leadEntry.description}</p>`
                    : null}
                  <div class="button-row" style="margin-top: var(--space-5)">
                    <a class="button" href="${ctx.readUrl(lead, lang)}">${t('action.read')}</a>
                    <a class="button button--secondary" href="${ctx.flyerUrl(lead, lang)}"
                      >${t('action.more')}</a
                    >
                  </div>
                </div>
              </div>
            </section>
          `
        : null}

      ${selected.length > 0
        ? html`
            <section class="section" aria-labelledby="ausgewaehlt">
              <div class="section__head">
                <h2 class="section__title" id="ausgewaehlt">${t('home.recommended')}</h2>
                <a class="section__link" href="${ctx.archiveUrl(lang)}">${t('home.allFlyers')}</a>
              </div>
              ${flyerGrid(ctx, selected, lang)}
            </section>
          `
        : null}

      ${topics.length > 0
        ? html`
            <section class="section" aria-labelledby="themen">
              <div class="section__head">
                <h2 class="section__title" id="themen">${t('home.topics')}</h2>
                <a class="section__link" href="${ctx.topicsUrl(lang)}">${t('action.more')}</a>
              </div>
              <ul class="tag-list">
                ${topics.map(
                  (topic) => html`
                    <li>
                      <a class="tag" href="${ctx.topicUrl(topic.slug, lang)}"
                        >${topic.languages[lang].title}</a
                      >
                    </li>
                  `,
                )}
              </ul>
            </section>
          `
        : null}

      ${latest.length > 0
        ? html`
            <section class="section" aria-labelledby="neu">
              <div class="section__head">
                <h2 class="section__title" id="neu">${t('home.latest')}</h2>
                <a class="section__link" href="${ctx.archiveUrl(lang)}">${t('home.allFlyers')}</a>
              </div>
              ${flyerGrid(ctx, latest, lang)}
            </section>
          `
        : null}
    </div>
  `;

  return layout(ctx, {
    lang,
    title: null,
    description: page.description || page.intro || ctx.config.tagline?.[lang] || '',
    canonical: ctx.home(lang),
    alternates: ctx.altsForHome(),
    image: lead ? ctx.media?.shareImage(lead, lang) : null,
    current: 'home',
    ogUrl: selfPath,
    banner,
    main,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: ctx.config.organization?.name ?? ctx.config.siteName,
      url: ctx.config.baseUrl,
    },
  });
}
