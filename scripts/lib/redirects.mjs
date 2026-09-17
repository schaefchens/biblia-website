/**
 * Weiterleitungen von früheren Adressen.
 *
 * Gedruckte Flyer tragen die Kurzadresse /f/123/ — die ändert sich nie.
 * Geteilt wird in Messengern und Suchmaschinen aber die lesbare Adresse
 * /de/flyer/hoffnung/. Wird ein Flyer umbenannt, bricht jeder dieser Links.
 *
 * npm run check trägt den früheren Namen in slug_history ein; hier entsteht
 * daraus die dauerhafte Weiterleitung. Ohne diesen Schritt wäre der Eintrag
 * in slug_history wirkungslos.
 */

/** Die Adressen, die einen Flyer-slug enthalten. */
const ROUTE_KEYS = ['flyer', 'read', 'text'];

/**
 * Sammelt alle Weiterleitungen aus slug_history.
 *
 * @param {object} options
 * @param {object} options.config
 * @param {object} options.content
 * @returns {Array<{from:string, to:string, flyer:string}>} Pfade, keine vollständigen Adressen.
 */
export function collectRedirects({ config, content }) {
  const redirects = [];
  const seen = new Map();

  for (const flyer of content.flyers) {
    if (flyer.slugHistory.length === 0) continue;

    for (const lang of config.languageCodes) {
      // Nur Sprachen, in denen es die Zieladresse auch wirklich gibt.
      if (!content.isReachable(flyer, lang)) continue;

      for (const routeKey of ROUTE_KEYS) {
        const to = config.urls.route(lang, routeKey, flyer.slug);
        for (const old of flyer.slugHistory) {
          const from = config.urls.route(lang, routeKey, old);
          if (from === to || seen.has(from)) continue;
          seen.set(from, flyer.dirName);
          redirects.push({ from, to, flyer: flyer.dirName });
        }
      }
    }
  }

  redirects.sort((a, b) => a.from.localeCompare(b.from));
  return redirects;
}
