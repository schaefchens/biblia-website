import { html } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';

/** Redaktionelle Seite: Über uns, Impressum, Datenschutz. */
export function contentPage(ctx, { lang, name, entry, canonical, alternates, current = null }) {
  const main = html`
    <div class="page page--text">
      <header class="list-header">
        <h1>${entry.title}</h1>
        ${entry.intro ? html`<p class="hero__intro">${entry.intro}</p>` : null}
      </header>
      <div class="prose">${entry.bodyHtml}</div>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: entry.title,
    description: entry.description,
    canonical,
    alternates,
    current,
    main,
  });
}
