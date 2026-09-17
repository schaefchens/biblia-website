/**
 * Die einzige Stelle im Projekt, an der URLs gebaut werden.
 *
 * Die Website liegt unter einem Unterverzeichnis (z. B. https://host/v3/).
 * Jeder handgeschriebene Pfad wie "/de/flyer/" wäre dort falsch und würde
 * erst nach dem Deployment auffallen. Deshalb baut ausschliesslich dieses
 * Modul Pfade, und scripts/lib/linkcheck.mjs prüft danach das Ergebnis.
 */

/** Zerlegt eine baseUrl in Origin und Basispfad. */
export function parseBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      `baseUrl ist keine gültige Adresse: ${JSON.stringify(baseUrl)}\n` +
        'Erwartet wird z. B. "https://biblia.at/" oder "https://host.tld/v3/".',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`baseUrl muss mit http:// oder https:// beginnen: ${baseUrl}`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`baseUrl darf keine Parameter oder Anker enthalten: ${baseUrl}`);
  }
  // Basispfad immer in der Form "/" oder "/abc/" normalisieren.
  const basePath = `/${parsed.pathname.split('/').filter(Boolean).join('/')}/`.replace(/^\/\/+/, '/');
  return { origin: parsed.origin, basePath };
}

/** Prüft und normalisiert einzelne Pfadsegmente. */
function normalizeSegments(segments) {
  const out = [];
  for (const raw of segments.flat(Infinity)) {
    if (raw === null || raw === undefined || raw === '') continue;
    const value = String(raw);
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      throw new Error(`Pfadsegment darf keine vollständige Adresse sein: ${value}`);
    }
    for (const part of value.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        throw new Error('Pfadsegment ".." ist nicht erlaubt.');
      }
      out.push(part);
    }
  }
  return out;
}

/** Heuristik: hat das letzte Segment eine Dateiendung? */
function looksLikeFile(segments) {
  const last = segments[segments.length - 1];
  return typeof last === 'string' && /\.[a-z0-9]{1,8}$/i.test(last);
}

/**
 * Baut die URL-Helfer für eine konkrete Konfiguration.
 *
 * @param {object} options
 * @param {string} options.baseUrl        z. B. "https://biblia.schaefchens.de/v3/"
 * @param {object} [options.routes]       Sprachabhängige Routen-Segmente
 * @param {object} [options.shortRoutes]  Segmente der permanenten Kurz-URLs
 */
export function createUrls({ baseUrl, routes = {}, shortRoutes = {} }) {
  const { origin, basePath } = parseBaseUrl(baseUrl);

  /** Verzeichnis-URL mit abschliessendem "/" — für Seiten. */
  function dir(...segments) {
    const parts = normalizeSegments(segments);
    return parts.length === 0 ? basePath : `${basePath}${parts.join('/')}/`;
  }

  /** Datei-URL ohne abschliessendes "/" — für Assets, Bilder, sitemap.xml. */
  function file(...segments) {
    const parts = normalizeSegments(segments);
    if (parts.length === 0) {
      throw new Error('file() braucht mindestens ein Segment.');
    }
    return `${basePath}${parts.join('/')}`;
  }

  /** Erkennt anhand der Dateiendung automatisch Datei oder Verzeichnis. */
  function path(...segments) {
    const parts = normalizeSegments(segments);
    return looksLikeFile(parts) ? file(parts) : dir(parts);
  }

  /** Absolute Adresse — für canonical, hreflang, sitemap, OpenGraph und QR-Codes. */
  function abs(...segments) {
    return `${origin}${path(...segments)}`;
  }

  /** Nachschlagen eines sprachabhängigen Routen-Segments, z. B. route('de','read') -> 'lesen'. */
  function segment(lang, key) {
    const table = routes[lang];
    if (!table) {
      throw new Error(`Keine Routen-Tabelle für Sprache "${lang}" in config/site.json.`);
    }
    const value = table[key];
    if (!value) {
      throw new Error(`Routen-Segment "${key}" fehlt für Sprache "${lang}" in config/site.json.`);
    }
    return value;
  }

  /** Sprachabhängige Seiten-URL: route('de','read','hoffnung') -> '/v3/de/lesen/hoffnung/'. */
  function route(lang, key, ...rest) {
    return dir(lang, segment(lang, key), ...rest);
  }

  /** Sprach-Startseite: langHome('de') -> '/v3/de/'. */
  function langHome(lang) {
    return dir(lang);
  }

  /** Permanente Kurz-URL zu einem Flyer: short('flyer', 123) -> '/v3/f/123/'. */
  function short(kind, id) {
    const seg = shortRoutes[kind];
    if (!seg) {
      throw new Error(`Kurz-Route "${kind}" fehlt in config/site.json (shortRoutes).`);
    }
    return dir(seg, String(id));
  }

  const asset = (...segments) => file('assets', ...segments);
  const media = (...segments) => file('media', ...segments);

  /** Entfernt den Basispfad — für den Link-Prüfer und für Dateipfade in dist/. */
  function stripBase(urlOrPath) {
    let value = urlOrPath;
    if (value.startsWith(origin)) value = value.slice(origin.length);
    if (!value.startsWith('/')) return null;
    if (basePath === '/') return value;
    if (value === basePath.slice(0, -1)) return '/';
    if (!value.startsWith(basePath)) return null;
    return `/${value.slice(basePath.length)}`;
  }

  /** Liegt die Adresse innerhalb dieser Website? */
  const isInternal = (urlOrPath) => stripBase(urlOrPath) !== null;

  return {
    origin,
    basePath,
    baseUrl: `${origin}${basePath}`,
    dir,
    file,
    path,
    abs,
    segment,
    route,
    langHome,
    short,
    asset,
    media,
    stripBase,
    isInternal,
  };
}
