import { html, raw } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { field, honeypot } from '../components/form-field.mjs';

/**
 * "Meine Auswahl" — die Bestellseite.
 *
 * Die Seite selbst ist statisch. Die Auswahl liegt ausschliesslich im
 * Browser; erst beim Absenden wird ein PHP-Endpunkt aufgerufen.
 *
 * Bewusst keine Warenkorb-Sprache: es geht um eine unverbindliche
 * Bestellanfrage, nicht um einen Kauf.
 */
export function orderPage(ctx, lang) {
  const t = ctx.t(lang);
  const canonical = ctx.orderUrl(lang);

  const main = html`
    <div class="page page--text">
      <header class="list-header">
        <h1>${t('selection.title')}</h1>
        <p class="hero__intro">${t('selection.note')}</p>
      </header>

      ${ctx.isStaging ? html`<p class="notice notice--test">${t('form.testMode')}</p>` : null}

      <section class="selection" aria-labelledby="auswahl">
        <h2 class="visually-hidden" id="auswahl">${t('selection.title')}</h2>

        <div class="selection__empty" data-selection-empty>
          <p>${t('selection.empty')}</p>
          <p class="card__meta">${t('selection.emptyHint')}</p>
          <p class="button-row" style="margin-top: var(--space-5)">
            <a class="button" href="${ctx.archiveUrl(lang)}">${t('action.allFlyers')}</a>
          </p>
        </div>

        <ul
          class="selection__list"
          data-selection-list
          data-label-quantity="${t('selection.quantity')}"
          data-label-remove="${t('selection.remove')}"
          data-max-quantity="${ctx.config.order?.defaultMaxQuantity ?? 100}"
          hidden
        ></ul>
      </section>

      <form
        class="form"
        data-order-form
        method="post"
        action="${ctx.urls.file('api/order.php')}"
        data-label-sending="${t('form.sending')}"
        data-label-success-title="${t('form.successTitle')}"
        data-label-success="${t('form.successOrder')}"
        data-label-error="${t('form.errorGeneric')}"
        data-label-validation="${t('form.errorValidation')}"
        data-label-rate-limit="${t('form.errorRateLimit')}"
        hidden
      >
        <input type="hidden" name="language" value="${lang}" />
        <div class="form__grid">
          ${field({ id: 'name', name: 'name', label: t('form.name'), required: true, autocomplete: 'name', span: 2 })}
          ${field({ id: 'email', name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email', span: 2 })}
          ${field({ id: 'street', name: 'street', label: t('form.street'), required: true, autocomplete: 'street-address', span: 2 })}
          ${field({ id: 'plz', name: 'postal_code', label: t('form.postalCode'), required: true, autocomplete: 'postal-code' })}
          ${field({ id: 'ort', name: 'city', label: t('form.city'), required: true, autocomplete: 'address-level2' })}
          ${field({ id: 'land', name: 'country', label: t('form.country'), required: true, autocomplete: 'country-name', span: 2 })}
          ${field({ id: 'nachricht', name: 'message', label: t('form.message'), rows: 4, span: 2 })}
        </div>

        ${honeypot()}

        <p class="form__privacy">
          ${raw(
            t('form.privacyNote', {
              privacyLink: `<a href="${ctx.pageUrl('privacy', lang)}">${t('nav.privacy')}</a>`,
            }),
          )}
        </p>

        <div class="form__actions">
          <button class="button button--large" type="submit" data-form-submit>
            ${t('selection.submit')}
          </button>
          <p class="form__status" data-form-status role="status" aria-live="polite"></p>
        </div>
      </form>

      <noscript>
        <p class="notice">${t('selection.noscript')}</p>
        <p class="button-row">
          <a class="button" href="${ctx.pageUrl('contact', lang)}">${t('nav.contact')}</a>
        </p>
      </noscript>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: t('selection.title'),
    description: t('selection.note'),
    canonical,
    alternates: ctx.altsForRoute('order'),
    current: 'order',
    noindex: true,
    main,
  });
}
