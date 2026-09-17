/**
 * Der bestellbare Bestand, wie ihn der Server kennt.
 *
 * Die Auswahl entsteht im Browser und wird beim Absenden mitgeschickt.
 * Alles, was von dort kommt, ist eine Behauptung: eine erfundene Nummer,
 * eine Nummer aus einem Entwurf, eine Menge von 999. Der PHP-Endpunkt darf
 * sich darauf nicht verlassen und prüft deshalb gegen diese Liste, die beim
 * Build aus den Inhalten entsteht.
 */

/**
 * Baut den Bestand für den Server.
 *
 * @param {object} options
 * @param {object} options.config
 * @param {object} options.content
 * @returns {Record<string, object>}  Nummer -> Angaben
 */
export function buildCatalog({ config, content }) {
  const catalog = {};

  for (const flyer of content.flyers) {
    if (!flyer.order.enabled) continue;
    // Entwürfe, geplante und archivierte Flyer werden nicht mehr aufgelegt
    // und sind damit auch nicht bestellbar.
    const languages = config.languageCodes.filter((lang) => content.isListed(flyer, lang));
    if (languages.length === 0) continue;

    const titles = {};
    for (const lang of languages) titles[lang] = flyer.languages[lang].title;

    catalog[String(flyer.id)] = {
      slug: flyer.slug,
      title: titles[config.defaultLanguage] ?? titles[languages[0]],
      titles,
      min: flyer.order.minQuantity,
      max: flyer.order.maxQuantity,
      price: flyer.order.price,
      currency: flyer.order.currency,
    };
  }

  return catalog;
}
