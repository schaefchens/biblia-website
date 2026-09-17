import { html, attrs, jsonScript } from '../../scripts/lib/html.mjs';

/**
 * Hinweis auf eine andere Sprachfassung.
 *
 * Wird nur auf den sprachneutralen Einstiegen verwendet: der Startseite
 * ohne Sprachkürzel und den dauerhaften Kurzadressen /f/123 und /r/123.
 *
 * Bewusst ein Angebot und keine automatische Weiterleitung:
 *   - Eine Weiterleitung per JavaScript würde für Vorschauen in WhatsApp,
 *     Signal oder Telegram nichts bringen, weil diese kein JavaScript
 *     ausführen — sie würden eine leere Seite sehen.
 *   - Ohne JavaScript wäre die Adresse eine Sackgasse.
 *   - Und wer den Link bewusst weitergegeben hat, soll nicht plötzlich
 *     auf einer anderen Sprachfassung landen.
 *
 * Deshalb steht der Inhalt vollständig da, und die Sprachwahl ist ein
 * Hinweis, den man wegklicken kann.
 */
export function languageBanner(ctx, { lang, alternates }) {
  const others = alternates.filter((alt) => alt.lang !== lang);
  if (others.length === 0) return null;

  const options = others.map((alt) => ({
    lang: alt.lang,
    href: alt.href,
    label: ctx.languageLabel(alt.lang),
    notice: ctx.t(alt.lang)('language.switchNotice', { language: ctx.languageLabel(alt.lang) }),
    action: ctx.t(alt.lang)('language.switchAction'),
    dismiss: ctx.t(alt.lang)('language.dismiss'),
  }));

  return html`
    <div class="language-banner" data-language-banner hidden>
      <p class="language-banner__text" data-language-banner-text></p>
      <a class="button button--secondary" href="#" data-language-banner-link></a>
      <button class="button button--quiet" type="button" data-language-banner-dismiss>
        <span aria-hidden="true">×</span>
        <span class="visually-hidden" data-language-banner-dismiss-label></span>
      </button>
    </div>
    <script type="application/json" data-language-options>
      ${jsonScript(options)}
    </script>
    <noscript>
      <div class="language-banner">
        <p class="language-banner__text">${ctx.t(lang)('language.label')}:</p>
        <ul class="tag-list">
          ${others.map(
            (alt) => html`
              <li>
                <a class="tag" href="${alt.href}" ${attrs({ hreflang: alt.lang, lang: alt.lang })}
                  >${ctx.languageLabel(alt.lang)}</a
                >
              </li>
            `,
          )}
        </ul>
      </div>
    </noscript>
  `;
}
