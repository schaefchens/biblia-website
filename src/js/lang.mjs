/**
 * Sprachhinweis auf den sprachneutralen Einstiegen.
 *
 * Es wird nichts automatisch umgeleitet — siehe die Begründung in
 * src/components/language-banner.mjs. Passt die Browsersprache besser zu
 * einer anderen Fassung, erscheint ein Hinweis mit einem Link.
 */
const DISMISS_KEY = 'biblia:language-dismissed';

function isDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* nicht schlimm — der Hinweis erscheint dann erneut */
  }
}

export function initLanguageBanner() {
  const banner = document.querySelector('[data-language-banner]');
  const data = document.querySelector('[data-language-options]');
  if (!banner || !data || isDismissed()) return;

  let options;
  try {
    options = JSON.parse(data.textContent);
  } catch {
    return;
  }
  if (!Array.isArray(options) || options.length === 0) return;

  const preferred = (navigator.languages ?? [navigator.language ?? ''])
    .map((tag) => String(tag).toLowerCase().split('-')[0])
    .filter(Boolean);

  // Die erste Browsersprache gewinnt, für die es eine Fassung gibt.
  const match = preferred.map((code) => options.find((o) => o.lang === code)).find(Boolean);
  if (!match) return;

  const pageLanguage = (document.documentElement.lang || '').toLowerCase().split('-')[0];
  if (match.lang === pageLanguage) return;

  banner.querySelector('[data-language-banner-text]').textContent = match.notice;
  const link = banner.querySelector('[data-language-banner-link]');
  link.href = match.href;
  link.textContent = match.action;
  link.setAttribute('hreflang', match.lang);
  link.setAttribute('lang', match.lang);
  banner.querySelector('[data-language-banner-dismiss-label]').textContent = match.dismiss;

  banner.querySelector('[data-language-banner-dismiss]').addEventListener('click', () => {
    banner.hidden = true;
    dismiss();
  });

  banner.hidden = false;
}
