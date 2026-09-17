import { html } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';

/** Übersicht aller Themen und Kategorien. */
export function topicsIndexPage(ctx, lang) {
  const t = ctx.t(lang);

  const withFlyers = (items, routeKey) =>
    [...items.values()]
      .filter((item) => item.languages[lang])
      .map((item) => ({
        item,
        count: item.flyers.filter((f) => f.status === 'published' && f.languages[lang]).length,
        href: routeKey === 'topics' ? ctx.topicUrl(item.slug, lang) : ctx.categoryUrl(item.slug, lang),
      }))
      .filter((entry) => entry.count > 0)
      .sort(
        (a, b) =>
          (a.item.order ?? 999) - (b.item.order ?? 999) || a.item.slug.localeCompare(b.item.slug),
      );

  const categories = withFlyers(ctx.content.categories, 'categories');
  const topics = withFlyers(ctx.content.topics, 'topics');

  const list = (entries) => html`
    <ul class="link-list">
      ${entries.map(
        ({ item, count, href }) => html`
          <li class="link-list__item">
            <a class="link-list__link" href="${href}">${item.languages[lang].title}</a>
            <span class="link-list__count">${t.plural('archive.results', count)}</span>
          </li>
        `,
      )}
    </ul>
  `;

  const main = html`
    <div class="page">
      <header class="list-header">
        <h1>${t('nav.topics')}</h1>
      </header>

      ${categories.length > 0
        ? html`
            <section class="section">
              <div class="section__head">
                <h2 class="section__title">${t('nav.categories')}</h2>
              </div>
              ${list(categories)}
            </section>
          `
        : null}

      ${topics.length > 0
        ? html`
            <section class="section">
              <div class="section__head">
                <h2 class="section__title">${t('nav.topics')}</h2>
              </div>
              ${list(topics)}
            </section>
          `
        : null}
    </div>
  `;

  return layout(ctx, {
    lang,
    title: t('nav.topics'),
    description: '',
    canonical: ctx.topicsUrl(lang),
    alternates: ctx.altsForRoute('topics'),
    current: 'topics',
    main,
  });
}
