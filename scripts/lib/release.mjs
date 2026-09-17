/**
 * Freigabe für die endgültige Domain.
 *
 * Auf der Testadresse ist alles erlaubt: Beispielinhalte, Platzhalter im
 * Impressum, erfundene E-Mail-Adressen. Genau das darf aber nicht
 * versehentlich in den echten Betrieb rutschen — dort hängen ein
 * Vereinsregister, ein Datenschutzhinweis und erreichbare Adressen daran.
 *
 * Deshalb wird jede dieser Stellen geprüft, sobald die Website unter ihrer
 * endgültigen Domain läuft. Vorher sind dieselben Punkte nur Hinweise.
 */

/**
 * Domains, die es absichtlich nie geben wird (RFC 2606 und RFC 6761).
 * Eine Bestellung an eine solche Adresse verschwindet spurlos.
 */
const RESERVED_DOMAINS = [
  'example.com',
  'example.net',
  'example.org',
  'example.edu',
  'localhost',
];
const RESERVED_TLD = /\.(?:invalid|test|example|localhost)$/i;
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

/**
 * Textstellen, die eindeutig aus den Beispielinhalten stammen.
 * Bewusst kurz gehalten: jeder Eintrag muss ein klarer Platzhalter sein,
 * der in einem echten Impressum niemals stünde.
 */
const PLACEHOLDER_PHRASES = [
  'example.invalid',
  'Straße und Hausnummer',
  'Postleitzahl Ort',
  'Name der vertretungsberechtigten Person',
  'ZVR-Zahl: 000000000',
  'muss vor der Veröffentlichung',
  'Street and number',
  'Postal code, city',
  'before publishing',
];

/** Seiten, die vor dem Start rechtlich vollständig sein müssen. */
const LEGAL_PAGES = ['imprint', 'privacy'];

/** Ist das eine Adresse, an die wirklich eine E-Mail zugestellt werden kann? */
export function isDeliverableEmail(value) {
  const email = String(value ?? '').trim();
  if (!EMAIL.test(email)) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (RESERVED_TLD.test(domain)) return false;
  return !RESERVED_DOMAINS.includes(domain);
}

/**
 * Prüft alles, was vor der Veröffentlichung unter der echten Domain
 * erledigt sein muss.
 *
 * @param {object} options
 * @param {object} options.config
 * @param {object} options.content
 * @returns {Array<{subject:string, message:string, hint?:string, file?:string}>}
 */
export function releaseBlockers({ config, content }) {
  const problems = [];
  const add = (subject, message, extra = {}) => problems.push({ subject, message, ...extra });

  // --- 1. Beispielinhalte ---
  const demoFlyers = content.flyers.filter((flyer) => flyer.demo);
  if (demoFlyers.length > 0) {
    add(
      'Beispielinhalte',
      `${demoFlyers.length} von ${content.flyers.length} Flyern sind Beispielinhalte (demo: true).`,
      {
        file: demoFlyers[0].sourceFile,
        hint:
          `Betroffen: ${demoFlyers.map((f) => f.dirName).join(', ')}.\n` +
          '      Entfernen mit:  npm run demo -- --remove',
      },
    );
  }

  const demoPages = [...content.pages.values()].filter((page) => page.demo);
  const demoTaxonomy = [...content.topics.values(), ...content.categories.values()].filter(
    (item) => item.demo,
  );
  if (demoPages.length > 0 || demoTaxonomy.length > 0) {
    const parts = [];
    if (demoPages.length > 0) parts.push(`Seiten: ${demoPages.map((p) => p.name).join(', ')}`);
    if (demoTaxonomy.length > 0) {
      parts.push(`Themen und Kategorien: ${demoTaxonomy.map((i) => i.slug).join(', ')}`);
    }
    add('Beispielinhalte', 'Es sind noch Beispieltexte als Inhalt hinterlegt (demo: true).', {
      hint: `${parts.join(' — ')}.\n      Entfernen mit:  npm run demo -- --remove`,
    });
  }

  // --- 2. Erreichbare Adressen ---
  const addresses = [
    ['order.recipientEmail', config.order?.recipientEmail, 'Bestellanfragen gehen an diese Adresse.'],
    ['order.senderEmail', config.order?.senderEmail, 'Von dieser Adresse verschickt der Server.'],
    ['contact.recipientEmail', config.contact?.recipientEmail, 'Kontaktnachrichten gehen an diese Adresse.'],
    ['organization.email', config.organization?.email, 'Steht in den strukturierten Daten.'],
  ];
  for (const [key, value, purpose] of addresses) {
    if (!value) {
      add('config/site.json', `Die Adresse "${key}" fehlt.`, { hint: purpose });
      continue;
    }
    if (!isDeliverableEmail(value)) {
      add('config/site.json', `"${key}" ist keine zustellbare E-Mail-Adresse: ${value}`, {
        hint: `${purpose} Eine Adresse auf .invalid oder example.com erreicht niemanden.`,
      });
    }
  }

  // --- 3. Rechtliche Seiten ---
  for (const name of LEGAL_PAGES) {
    const page = content.pages.get(name);
    if (!page) {
      add(`Seite ${name}`, 'Die Seite fehlt vollständig.', {
        hint: `Erwartet wird content/pages/${name}.${config.defaultLanguage}.md.`,
      });
      continue;
    }
    for (const lang of config.languageCodes) {
      const entry = page.languages[lang];
      if (!entry?.title) {
        add(`Seite ${name}`, `${lang.toUpperCase()}: Die Seite fehlt oder hat keinen Titel.`, {
          hint: `Lege content/pages/${name}.${lang}.md mit  title:  an.`,
        });
        continue;
      }
      const found = PLACEHOLDER_PHRASES.filter((phrase) => entry.body.includes(phrase));
      if (found.length > 0) {
        add(`Seite ${name}`, `${lang.toUpperCase()}: Der Text enthält noch Platzhalter.`, {
          file: entry.file,
          hint: `Gefunden: ${found.map((f) => `"${f}"`).join(', ')}.`,
        });
      }
    }
  }

  // --- 4. Gibt es überhaupt etwas zu veröffentlichen? ---
  const published = content.published(config.defaultLanguage);
  if (published.length === 0) {
    add('Inhalte', `Es ist kein einziger Flyer in der Standardsprache veröffentlicht.`, {
      hint: 'Setze in flyer.md  status: published.',
    });
  }

  return problems;
}

/**
 * Trägt das Ergebnis in die Meldungsliste der Inhalte ein.
 *
 * Auf der Testadresse sind es Hinweise — dort gehören Beispielinhalte hin.
 * Unter der endgültigen Domain sind es Fehler und verhindern damit sowohl
 * npm run build als auch npm run publish.
 *
 * @returns {{ level: 'error'|'warning', problems: Array }}
 */
export function applyReleaseChecks({ config, content }) {
  const problems = releaseBlockers({ config, content });
  const level = config.isStaging ? 'warning' : 'error';
  for (const problem of problems) {
    const { subject, message, ...extra } = problem;
    content.issues[level](subject, message, extra);
  }
  return { level, problems };
}
