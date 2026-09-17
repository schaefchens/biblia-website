/**
 * Suchindex für das Archiv.
 *
 * Bewusst nur die beschreibenden Angaben — nicht der aus den PDF-Dateien
 * gelesene Volltext. Bei dreihundert Flyern in mehreren Sprachen käme der
 * Volltext auf mehrere Megabyte; das jemandem auf dem Telefon zuzumuten,
 * nur weil er etwas in ein Suchfeld tippt, wäre nicht vertretbar.
 *
 * Der Volltext ist deshalb nicht verloren, sondern steht auf den Seiten
 * "Als Text lesen" — die sind fertig ausgeliefertes HTML und werden von
 * Suchmaschinen ohnehin ausgewertet.
 *
 * Damit das nicht unbemerkt wieder anwächst, bricht der Build ab, sobald
 * der Index eine festgelegte Grösse überschreitet.
 */
import zlib from 'node:zlib';
import { truncate } from './markdown.mjs';
import { fail } from './log.mjs';

/**
 * Die Felder in fester Reihenfolge — als Liste statt als Objekt.
 * Das spart bei jedem Eintrag die wiederholten Feldnamen.
 */
export const FIELDS = ['id', 'slug', 'title', 'text', 'category', 'topics', 'tags', 'cover', 'aspect'];

/** Sucheinträge einer Sprache. */
export function buildSearchIndex({ config, content, ctx, lang }) {
  const flyers = content.published(lang);

  const entries = flyers.map((flyer) => {
    const entry = flyer.languages[lang];
    const cover = ctx.media?.cover(flyer, lang) ?? null;

    // Alles Durchsuchbare in einem Feld: Beschreibung, Schlagworte,
    // Stichworte und Bibelstellen. Das hält den Index klein und die
    // Suche einfach.
    const searchable = [
      entry.description,
      ...flyer.tags,
      ...entry.keywords,
      ...flyer.bibleRefs,
      ...flyer.topics.map((slug) => ctx.topicTitle(slug, lang)).filter(Boolean),
      ctx.categoryTitle(flyer.category, lang),
    ]
      .filter(Boolean)
      .join(' ');

    return [
      flyer.id,
      flyer.slug,
      entry.title,
      truncate(searchable, 400),
      flyer.category ?? '',
      flyer.topics,
      flyer.tags,
      cover ? cover.src : '',
      cover ? cover.aspect : '',
    ];
  });

  const topics = [...content.topics.values()]
    .filter((topic) => topic.languages[lang] && flyers.some((flyer) => flyer.topics.includes(topic.slug)))
    .map((topic) => [topic.slug, topic.languages[lang].title])
    .sort((a, b) => a[1].localeCompare(b[1], lang));

  const categories = [...content.categories.values()]
    .filter((category) => category.languages[lang] && flyers.some((flyer) => flyer.category === category.slug))
    .map((category) => [category.slug, category.languages[lang].title])
    .sort((a, b) => a[1].localeCompare(b[1], lang));

  return { fields: FIELDS, entries, topics, categories };
}

/**
 * Prüft die Grösse und bricht ab, wenn der Index zu gross wird.
 * Ohne diese Schranke wächst er unbemerkt, bis das Archiv auf dem
 * Telefon nicht mehr benutzbar ist.
 */
export function assertIndexBudget(json, maxBytesGzip, lang) {
  const gzipped = zlib.gzipSync(Buffer.from(json), { level: 9 }).length;
  if (gzipped > maxBytesGzip) {
    fail(
      `Der Suchindex für "${lang}" ist mit ${(gzipped / 1024).toFixed(0)} KB zu gross (erlaubt: ${(maxBytesGzip / 1024).toFixed(0)} KB).`,
      'Der Index wird bei jedem Besuch des Archivs geladen. Kürze die Beschreibungen, ' +
        'oder teile den Index auf mehrere Dateien auf (siehe scripts/lib/search-index.mjs).',
    );
  }
  return gzipped;
}
