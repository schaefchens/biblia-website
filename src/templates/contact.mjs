import { html, raw } from '../../scripts/lib/html.mjs';
import { layout } from './layout.mjs';
import { field, honeypot } from '../components/form-field.mjs';

/** Kontaktseite. Statisch; nur das Absenden geht an einen PHP-Endpunkt. */
export function contactPage(ctx, lang) {
  const t = ctx.t(lang);
  const page = ctx.content.pages.get('contact')?.languages[lang];
  const canonical = ctx.contactUrl(lang);

  const main = html`
    <div class="page page--text">
      <header class="list-header">
        <h1>${page?.title || t('nav.contact')}</h1>
        ${page?.intro ? html`<p class="hero__intro">${page.intro}</p>` : null}
      </header>

      ${page?.bodyHtml ? html`<div class="prose">${page.bodyHtml}</div>` : null}
      ${ctx.isStaging ? html`<p class="notice notice--test">${t('form.testMode')}</p>` : null}

      <form class="form" data-contact-form method="post" action="${ctx.urls.file('api/contact.php')}"
        data-label-sending="${t('form.sending')}"
        data-label-success-title="${t('form.successTitle')}"
        data-label-success="${t('form.successContact')}"
        data-label-error="${t('form.errorGeneric')}"
        data-label-validation="${t('form.errorValidation')}"
        data-label-rate-limit="${t('form.errorRateLimit')}"
      >
        <input type="hidden" name="language" value="${lang}" />
        <div class="form__grid">
          ${field({ id: 'k-name', name: 'name', label: t('form.name'), required: true, autocomplete: 'name', span: 2 })}
          ${field({ id: 'k-email', name: 'email', label: t('form.email'), type: 'email', required: true, autocomplete: 'email', span: 2 })}
          ${field({ id: 'k-betreff', name: 'subject', label: t('form.subject'), span: 2 })}
          ${field({ id: 'k-nachricht', name: 'message', label: t('form.message'), rows: 6, required: true, span: 2 })}
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
          <button class="button button--large" type="submit" data-form-submit>${t('form.send')}</button>
          <p class="form__status" data-form-status role="status" aria-live="polite"></p>
        </div>
      </form>
    </div>
  `;

  return layout(ctx, {
    lang,
    title: page?.title || t('nav.contact'),
    description: page?.description || '',
    canonical,
    alternates: ctx.altsForRoute('contact'),
    current: 'contact',
    main,
  });
}
