/**
 * Markdown-Darstellung für redaktionelle Texte.
 *
 * Absichtlich ohne HTML-Durchreichung: die Inhalte kommen aus Textdateien,
 * die von Hand gepflegt werden. Kein eingebettetes HTML bedeutet, dass ein
 * Tippfehler die Seite nicht zerlegen kann.
 */
import MarkdownIt from 'markdown-it';
import { raw } from './html.mjs';

/** Typografische Anführungszeichen je Sprache. */
const QUOTES = {
  de: '„“‚‘',
  en: '“”‘’',
  it: '«»‹›',
};

const cache = new Map();

function createRenderer(lang) {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: true,
    breaks: false,
    quotes: QUOTES[lang] ?? QUOTES.en,
  });

  // Externe Links absichern und erkennbar machen.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      tokens[idx].attrSet('rel', 'noopener');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

function rendererFor(lang) {
  if (!cache.has(lang)) cache.set(lang, createRenderer(lang));
  return cache.get(lang);
}

/** Markdown zu fertigem HTML (Blockebene). */
export function renderMarkdown(text, lang = 'de') {
  if (!text) return raw('');
  return raw(rendererFor(lang).render(text).trim());
}

/** Markdown zu HTML ohne umschliessenden Absatz — für kurze Texte. */
export function renderMarkdownInline(text, lang = 'de') {
  if (!text) return raw('');
  return raw(rendererFor(lang).renderInline(text).trim());
}

/** Markdown zu reinem Text — für Meta-Beschreibungen und den Suchindex. */
export function markdownToPlainText(text, lang = 'de') {
  if (!text) return '';
  return rendererFor(lang)
    .render(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kürzt Text auf eine maximale Länge an einer Wortgrenze. */
export function truncate(text, maxLength = 160) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
