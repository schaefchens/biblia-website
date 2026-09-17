import { html, attrs } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { flyerGrid } from '../components/flyer-card.mjs';

/**
 * Seitenweise Blätterleiste.
 * Echte Links — funktioniert ohne JavaScript und ist für Suchmaschinen sichtbar.
 */
function pagination(ctx, lang, { current, total, urlFor }) {
  if (total <= 1) return null;
  const t = ctx.t(lang);
  const numbers = [];
  for (let page = 1; page <= total; page += 1) {
    const near = Math.abs(page - current) <= 1 || page === 1 || page === total;
    if (near) numbers.push(page);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }

  return html`
    <nav class="pagination" aria-label="${t('archive.pagination')}">
      ${current > 1
        ? html`<a class="pagination__step" href="${urlFor(current - 1)}" rel="prev"
            >${t('archive.previousPage')}</a
          >`
        : null}
      <ul class="pagination__list">
        ${numbers.map((page) =>
          page === '…'
            ? html`<li class="pagination__gap" aria-hidden="true">…</li>`
            : html`<li>
                <a
                  class="pagination__page"
                  href="${urlFor(page)}"
                  ${attrs({ 'aria-current': page === current ? 'page' : null })}
                  >${page}</a
                >
              </li>`,
        )}
      </ul>
      ${current < total
        ? html`<a class="pagination__step" href="${urlFor(current + 1)}" rel="next"
            >${t('archive.nextPage')}</a
          >`
        : null}
    </nav>
  `;
}

/**
 * Gemeinsame Vorlage für Archiv, Themenseiten und Kategorieseiten.
 *
 * Die Liste steht vollständig im HTML. Suche und Filter ergänzt das
 * JavaScript später auf dieser Grundlage, ersetzt sie aber nicht.
 */
export function flyerListPage(ctx, options) {
  const {
    lang,
    title,
    description = '',
    introHtml = null,
    flyers,
    canonical,
    alternates,
    current = 'flyers',
    page = 1,
    totalPages = 1,
    urlFor = () => canonical,
    searchable = false,
    noindex = false,
  } = options;

  const t = ctx.t(lang);

  const main = html`
    <div class="page">
      <header class="list-header">
        <h1>${title}</h1>
        ${introHtml ? html`<div class="prose list-header__intro">${introHtml}</div>` : null}
        ${description && !introHtml ? html`<p class="hero__intro">${description}</p>` : null}
      </header>

      ${searchable
        ? html`
            <div
              class="filterbar"
              data-filterbar
              data-index-url="${ctx.urls.file(`search/${lang}.json`)}"
              data-flyer-base="${ctx.urls.route(lang, 'flyer')}"
              data-label-result-one="${t('archive.resultsOne')}"
              data-label-result-other="${t('archive.resultsOther')}"
              data-label-none="${t('archive.noResults')}"
              data-label-none-hint="${t('archive.noResultsHint')}"
              data-label-all="${t('archive.all')}"
              data-label-topic="${t('archive.filterTopic')}"
              data-label-category="${t('archive.filterCategory')}"
              data-label-cover="${t('flyer.cover', { title: '{title}' })}"
              hidden
            >
              <label class="visually-hidden" for="suche">${t('archive.search')}</label>
              <input
                class="filterbar__search"
                id="suche"
                type="search"
                data-search-input
                placeholder="${t('archive.searchPlaceholder')}"
                autocomplete="off"
              />
              <button class="button button--quiet" type="button" data-filter-reset hidden>
                ${t('archive.reset')}
              </button>
            </div>
          `
        : null}

      <p class="list-count" data-result-count aria-live="polite">
        ${t.plural('archive.results', flyers.length)}
      </p>

      <div data-flyer-list>
        ${flyers.length > 0
          ? flyerGrid(ctx, flyers, lang, { wide: false, eagerCount: 4 })
          : html`
              <div class="empty">
                <p>${t('archive.noResults')}</p>
                <p class="card__meta">${t('archive.noResultsHint')}</p>
              </div>
            `}
      </div>

      ${pagination(ctx, lang, { current: page, total: totalPages, urlFor })}
    </div>
  `;

  return layout(ctx, {
    lang,
    title: page > 1 ? `${title} — ${t('archive.pageLabel', { n: page })}` : title,
    description,
    canonical,
    alternates,
    current,
    noindex,
    main,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      inLanguage: lang,
      url: `${ctx.config.origin}${canonical}`,
    },
  });
}
