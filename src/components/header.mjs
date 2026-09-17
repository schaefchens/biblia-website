import { html, attrs } from '../../scripts/lib/html.mjs';

/**
 * Kopfzeile.
 * Bewusst knapp: die Flyer sollen die Aufmerksamkeit bekommen, nicht die Navigation.
 */
export function header(ctx, { lang, current = null }) {
  const t = ctx.t(lang);

  const items = [
    { key: 'flyers', href: ctx.archiveUrl(lang), label: t('nav.flyers') },
    { key: 'topics', href: ctx.topicsUrl(lang), label: t('nav.topics') },
    { key: 'about', href: ctx.pageUrl('about', lang), label: t('nav.about') },
    { key: 'contact', href: ctx.pageUrl('contact', lang), label: t('nav.contact') },
  ];

  return html`
    <header class="site-header">
      <div class="page site-header__inner">
        <a class="wordmark" href="${ctx.home(lang)}">${ctx.config.siteName}</a>

        <nav class="site-nav" aria-label="${t('nav.flyers')}">
          <ul class="site-nav__list">
            ${items.map(
              (item) => html`
                <li>
                  <a
                    class="site-nav__link"
                    href="${item.href}"
                    ${attrs({ 'aria-current': current === item.key ? 'page' : null })}
                    >${item.label}</a
                  >
                </li>
              `,
            )}
          </ul>
        </nav>

        <a
          class="site-nav__link site-nav__link--selection"
          href="${ctx.orderUrl(lang)}"
          data-selection-link
          ${attrs({ 'aria-current': current === 'order' ? 'page' : null })}
        >
          ${t('nav.selection')}<span class="selection-badge" data-selection-count hidden></span>
        </a>
      </div>
    </header>
  `;
}
