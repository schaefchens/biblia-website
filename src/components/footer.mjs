import { html, attrs } from '../../scripts/lib/html.mjs';

/**
 * Fußzeile mit rechtlichen Verweisen, Sprachwahl und Darstellung.
 *
 * Die Sprachwahl besteht aus echten Links und funktioniert deshalb auch
 * ohne JavaScript. Die Darstellung braucht JavaScript und wird nur dann
 * eingeblendet.
 */
export function footer(ctx, { lang, alternates = [] }) {
  const t = ctx.t(lang);
  const others = alternates.filter((alt) => alt.lang !== lang);

  return html`
    <footer class="site-footer">
      <div class="page site-footer__inner">
        <div>
          <p class="site-footer__tagline">${t('footer.tagline')}</p>
        </div>

        <div>
          <h2 class="site-footer__heading">${ctx.config.siteName}</h2>
          <ul class="site-footer__list">
            <li><a href="${ctx.archiveUrl(lang)}">${t('nav.flyers')}</a></li>
            <li><a href="${ctx.topicsUrl(lang)}">${t('nav.topics')}</a></li>
            <li><a href="${ctx.pageUrl('about', lang)}">${t('nav.about')}</a></li>
            <li><a href="${ctx.pageUrl('contact', lang)}">${t('nav.contact')}</a></li>
          </ul>
        </div>

        <div>
          <h2 class="site-footer__heading">${t('footer.legal')}</h2>
          <ul class="site-footer__list">
            <li><a href="${ctx.pageUrl('imprint', lang)}">${t('nav.imprint')}</a></li>
            <li><a href="${ctx.pageUrl('privacy', lang)}">${t('nav.privacy')}</a></li>
          </ul>
        </div>

        <div>
          <h2 class="site-footer__heading">${t('theme.label')} &amp; ${t('language.label')}</h2>
          <div class="settings">
            <div class="settings__group" data-theme-switcher hidden>
              <label class="settings__label" for="theme-select">${t('theme.label')}</label>
              <select id="theme-select" data-theme-select>
                <option value="system">${t('theme.system')}</option>
                <option value="light">${t('theme.light')}</option>
                <option value="dark">${t('theme.dark')}</option>
              </select>
            </div>

            ${others.length > 0
              ? html`
                  <div class="settings__group">
                    <span class="settings__label">${t('language.label')}</span>
                    <ul class="tag-list">
                      ${others.map(
                        (alt) => html`
                          <li>
                            <a
                              class="tag"
                              href="${alt.href}"
                              ${attrs({ hreflang: alt.lang, lang: alt.lang })}
                              data-language-link
                              >${ctx.languageLabel(alt.lang)}</a
                            >
                          </li>
                        `,
                      )}
                    </ul>
                  </div>
                `
              : null}
          </div>
        </div>
      </div>
    </footer>
  `;
}
