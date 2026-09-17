import { html, attrs } from '../../scripts/lib/html.mjs';

/**
 * Flyer-Karte.
 *
 * Sichtbar sind nur Cover, Titel und eine kurze Zusatzangabe. Bestellen,
 * Teilen, Sprache und Preis gehören auf die Detailseite — sonst wird aus
 * der Übersicht ein Katalog.
 */
export function flyerCard(ctx, flyer, lang, { headingLevel = 3, eager = false } = {}) {
  const entry = flyer.languages[lang];
  if (!entry) return null;

  const meta = ctx.cardMeta(flyer, lang);
  const Heading = `h${headingLevel}`;
  const coverMeta = ctx.media?.cover(flyer, lang) ?? null;
  const coverImage = ctx.media?.coverImage(ctx, flyer, lang, { eager, className: 'card__image' }) ?? null;

  return html`
    <a class="card" href="${ctx.flyerUrl(flyer, lang)}">
      <span
        class="card__media"
        ${attrs({
          style: [
            coverMeta ? `--card-aspect: ${coverMeta.aspect}` : null,
            coverMeta?.placeholder ? `background-image:url("${coverMeta.placeholder}")` : null,
          ]
            .filter(Boolean)
            .join(';') || null,
        })}
      >
        ${coverImage ?? html`<span class="card__placeholder" aria-hidden="true">${entry.title}</span>`}
      </span>
      <${Heading} class="card__title">${entry.title}</${Heading}>
      ${meta ? html`<p class="card__meta">${meta}</p>` : null}
    </a>
  `;
}

/** Ein Raster aus Flyer-Karten. */
export function flyerGrid(ctx, flyers, lang, options = {}) {
  const { wide = false, headingLevel = 3, eagerCount = 0 } = options;
  return html`
    <div class="grid ${wide ? 'grid--wide' : ''}">
      ${flyers.map((flyer, index) =>
        flyerCard(ctx, flyer, lang, { headingLevel, eager: index < eagerCount }),
      )}
    </div>
  `;
}
