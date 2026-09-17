/**
 * Bündelt alles, was eine Vorlage zum Rendern braucht.
 *
 * Vorlagen bekommen ausschliesslich diesen Kontext — insbesondere bauen sie
 * niemals selbst eine Adresse zusammen, sondern rufen die Helfer hier auf.
 */
import { truncate } from './markdown.mjs';

/**
 * @param {object} options
 * @param {object} options.config   Geprüfte Konfiguration
 * @param {object} options.content  Eingelesene Inhalte
 * @param {object} options.i18n     Oberflächentexte
 * @param {object} options.assets   Erzeugte Asset-Adressen (CSS, JS)
 * @param {object} [options.media]  Medien-Manifest aus der Bild-Pipeline
 */
export function createContext({ config, content, i18n, assets, media = null }) {
  const { urls } = config;

  /** Sprachen, in denen es diesen Flyer gibt. */
  const flyerLanguages = (flyer) =>
    config.languageCodes.filter((code) => Boolean(flyer.languages[code]));

  /**
   * Sprachen, in denen es diese Kategorie bzw. dieses Thema wirklich gibt.
   *
   * Die Bedingung muss genau der entsprechen, unter der der Build die Seite
   * erzeugt: eine Themenseite ohne passende Flyer wird nicht geschrieben,
   * also darf auch kein hreflang darauf verweisen.
   */
  const taxonomyLanguages = (item) =>
    config.languageCodes.filter(
      (code) =>
        Boolean(item.languages[code]) &&
        item.flyers.some((flyer) => flyer.status === 'published' && flyer.languages[code]),
    );

  /** Sprachen, in denen es diese redaktionelle Seite mit Titel gibt. */
  const pageLanguages = (name) => {
    const page = content.pages.get(name);
    if (!page) return [];
    return config.languageCodes.filter((code) => Boolean(page.languages[code]?.title));
  };

  const base = {
    config,
    content,
    urls,
    media,
    assets,
    isStaging: config.isStaging,

    /** Übersetzungsfunktion einer Sprache. */
    t: (lang) => i18n.for(lang),

    /** Bezeichnung einer Sprache, wie sie Besuchern angezeigt wird. */
    languageLabel: (code) =>
      config.activeLanguages.find((l) => l.code === code)?.label ?? code,

    htmlLang: (code) =>
      config.activeLanguages.find((l) => l.code === code)?.htmlLang ?? code,

    // ----- Adressen -----
    home: (lang) => urls.langHome(lang),
    flyerUrl: (flyer, lang) => urls.route(lang, 'flyer', flyer.slug),
    readUrl: (flyer, lang) => urls.route(lang, 'read', flyer.slug),
    textUrl: (flyer, lang) => urls.route(lang, 'text', flyer.slug),
    archiveUrl: (lang, page = 1) =>
      page <= 1 ? urls.route(lang, 'flyer') : urls.route(lang, 'flyer', `${urls.segment(lang, 'page')}-${page}`),
    topicUrl: (slug, lang) => urls.route(lang, 'topics', slug),
    topicsUrl: (lang) => urls.route(lang, 'topics'),
    categoryUrl: (slug, lang) => urls.route(lang, 'categories', slug),
    orderUrl: (lang) => urls.route(lang, 'order'),
    contactUrl: (lang) => urls.route(lang, 'contact'),
    pageUrl: (name, lang) => urls.route(lang, name),
    shortUrl: (flyer) => urls.short('flyer', flyer.id),
    shortReadUrl: (flyer) => urls.short('reader', flyer.id),
    /** Dauerhafte, absolute Adresse — für QR-Codes und zum Teilen. */
    permalink: (flyer) => urls.abs(urls.stripBase(urls.short('flyer', flyer.id)).slice(1)),

    // ----- Sprachverknüpfungen für hreflang -----
    /** Alternativen einer Seite, die es in allen Sprachen gibt. */
    altsForRoute(routeKey, ...segments) {
      return config.languageCodes.map((lang) => ({
        lang,
        href: urls.route(lang, routeKey, ...segments),
      }));
    },
    altsForHome() {
      return config.languageCodes.map((lang) => ({ lang, href: urls.langHome(lang) }));
    },
    altsForFlyer(flyer, routeKey = 'flyer') {
      return flyerLanguages(flyer).map((lang) => ({
        lang,
        href: urls.route(lang, routeKey, flyer.slug),
      }));
    },
    /** Alternativen einer redaktionellen Seite. */
    altsForPage(name) {
      return pageLanguages(name).map((lang) => ({ lang, href: urls.route(lang, name) }));
    },
    altsForTaxonomy(item, routeKey) {
      return taxonomyLanguages(item).map((lang) => ({
        lang,
        href: urls.route(lang, routeKey, item.slug),
      }));
    },

    flyerLanguages,
    taxonomyLanguages,
    pageLanguages,

    // ----- Inhaltliche Helfer -----
    /** Titel einer Kategorie in einer Sprache, mit Rückfall auf die Standardsprache. */
    categoryTitle(slug, lang) {
      const category = content.categories.get(slug);
      if (!category) return null;
      return category.languages[lang]?.title ?? category.languages[config.defaultLanguage]?.title ?? null;
    },
    topicTitle(slug, lang) {
      const topic = content.topics.get(slug);
      if (!topic) return null;
      return topic.languages[lang]?.title ?? topic.languages[config.defaultLanguage]?.title ?? null;
    },

    /** Kurzinfo unter dem Kartentitel: "8 Seiten · Lebensfragen". */
    cardMeta(flyer, lang) {
      const t = i18n.for(lang);
      const parts = [];
      const pages = media?.pageCount(flyer, lang);
      if (pages) parts.push(t.plural('flyer.pages', pages));
      const category = this.categoryTitle(flyer.category, lang);
      if (category) parts.push(category);
      return parts.join(' · ');
    },

    /** Beschreibung für Meta-Angaben, notfalls aus dem Fließtext. */
    metaDescription(flyer, lang) {
      const entry = flyer.languages[lang];
      if (!entry) return '';
      return truncate(entry.description || entry.bodyText, 160);
    },

    /**
     * Verwandte Flyer: gemeinsame Themen zuerst, dann gleiche Kategorie,
     * dann die neuesten. Bewusst eine feste Regel, damit das Ergebnis bei
     * jedem Build gleich ist.
     */
    relatedFlyers(flyer, lang, limit = 4) {
      const candidates = content
        .published(lang)
        .filter((other) => other.id !== flyer.id)
        .map((other) => {
          const sharedTopics = other.topics.filter((topic) => flyer.topics.includes(topic)).length;
          const sameCategory = other.category && other.category === flyer.category ? 1 : 0;
          return { other, score: sharedTopics * 10 + sameCategory * 3 };
        })
        .filter((entry) => entry.score > 0);

      candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const dateA = a.other.date ?? '';
        const dateB = b.other.date ?? '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return a.other.id - b.other.id;
      });

      return candidates.slice(0, limit).map((entry) => entry.other);
    },

    /** Flyer für die Startseite, nach featured_order sortiert. */
    featuredFlyers(lang, limit = 6) {
      return content
        .published(lang)
        .filter((flyer) => flyer.featured)
        .sort((a, b) => {
          const orderA = a.featuredOrder ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.featuredOrder ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.id - b.id;
        })
        .slice(0, limit);
    },
  };

  return base;
}
