import { html } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';

/** 404-Seite. Liegt im Wurzelverzeichnis und wird von der .htaccess ausgeliefert. */
export function notFoundPage(ctx, lang) {
  const t = ctx.t(lang);

  const main = html`
    <div class="page page--text">
      <header class="list-header">
        <h1>${t('error.notFoundTitle')}</h1>
        <p class="hero__intro">${t('error.notFoundText')}</p>
      </header>
      <div class="button-row">
        <a class="button" href="${ctx.archiveUrl(lang)}">${t('error.notFoundAction')}</a>
        <a class="button button--secondary" href="${ctx.home(lang)}">${t('site.home')}</a>
      </div>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: t('error.notFoundTitle'),
    description: t('error.notFoundText'),
    canonical: ctx.urls.file('404.html'),
    alternates: [],
    noindex: true,
    main,
  });
}
