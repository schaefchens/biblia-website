import { html, attrs } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { pictureElement } from '../../scripts/lib/media.mjs';

/**
 * Vollbild-Leseansicht.
 *
 * Alle Seiten stehen bereits im HTML und sind untereinander lesbar. Ohne
 * JavaScript ist das eine schlichte, funktionierende Bildergalerie. Mit
 * JavaScript wird daraus eine blätterbare Vollbildansicht.
 *
 * Die Seite bekommt noindex und verweist über canonical auf die
 * Detailseite — sonst würden zwei Adressen denselben Inhalt anbieten.
 */
export function readerPage(ctx, flyer, lang, options = {}) {
  const { selfPath = null } = options;
  const t = ctx.t(lang);
  const entry = flyer.languages[lang];
  const pages = ctx.media?.pages(flyer, lang) ?? [];
  const total = pages.length;

  const main = html`
    <div class="reader" data-reader data-reader-total="${total}">
      <header class="reader__bar">
        <a class="reader__close" href="${ctx.flyerUrl(flyer, lang)}" data-reader-close>
          <span aria-hidden="true">←</span> ${t('reader.close')}
        </a>

        <p class="reader__title">${entry.title}</p>

        <div class="reader__tools">
          <button class="reader__tool" type="button" data-reader-zoom hidden>
            ${t('reader.zoomIn')}
          </button>
          <button
            class="reader__tool"
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
                class="reader__tool"
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
      </header>

      <div class="reader__stage" data-reader-stage>
        ${pages.map((page, index) => {
          const image = ctx.media.page(flyer, lang, page.index);
          return html`
            <figure
              class="reader__page"
              data-reader-page="${page.index}"
              ${attrs({ style: `--page-aspect: ${page.aspect}` })}
            >
              ${image
                ? pictureElement(image, {
                    alt: t('flyer.page', { n: page.index, title: entry.title }),
                    className: 'reader__image',
                    eager: index === 0,
                  })
                : null}
              <figcaption class="reader__caption">
                ${t('reader.pageOf', { current: page.index, total })}
              </figcaption>
            </figure>
          `;
        })}
      </div>

      <nav class="reader__nav" data-reader-nav hidden>
        <button class="reader__step" type="button" data-reader-prev>
          <span aria-hidden="true">‹</span>
          <span class="visually-hidden">${t('reader.previous')}</span>
        </button>
        <p class="reader__counter" data-reader-counter aria-live="polite">
          ${t('reader.pageOf', { current: 1, total })}
        </p>
        <button class="reader__step" type="button" data-reader-next>
          <span aria-hidden="true">›</span>
          <span class="visually-hidden">${t('reader.next')}</span>
        </button>
      </nav>

      <p class="reader__hint visually-hidden" data-reader-hint>${t('reader.keyboardHint')}</p>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: entry.title,
    description: ctx.metaDescription(flyer, lang),
    // Die Leseansicht ist ein zweiter Blick auf denselben Inhalt.
    // Maßgeblich ist die Detailseite.
    canonical: ctx.flyerUrl(flyer, lang),
    alternates: ctx.altsForFlyer(flyer, 'read'),
    image: ctx.media?.shareImage(flyer, lang),
    ogUrl: selfPath,
    noindex: true,
    bare: true,
    bodyClass: 'is-reader',
    main,
  });
}
