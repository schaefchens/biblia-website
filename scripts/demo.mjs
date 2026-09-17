/**
 * npm run demo            Beispielinhalte anlegen
 * npm run demo -- --force Vorhandene überschreiben
 * npm run demo -- --remove Beispielinhalte wieder entfernen
 *
 * Die Beispielinhalte sind an "demo: true" in flyer.md erkennbar.
 * Entfernt werden nur Dateien, die diese Markierung tragen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveHome, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { blank, heading, info, ok, step, warn, runMain, plural, color } from './lib/log.mjs';
import { CATEGORIES, TOPICS, FLYERS, taxonomyIntro } from './lib/demo-data.mjs';
import { createDemoPdf } from './lib/demo-pdf.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const remove = args.includes('--remove');

const MARKER = 'demo: true';

function writeFile(file, content, { overwrite = force } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !overwrite) return false;
  fs.writeFileSync(file, content);
  return true;
}

/** YAML-Wert sicher schreiben: Texte mit Sonderzeichen in Anführungszeichen. */
function yamlValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = String(value);
  return /^[A-Za-z0-9][A-Za-z0-9 .,_-]*$/.test(text) ? text : JSON.stringify(text);
}

function yamlList(name, values) {
  if (!values || values.length === 0) return '';
  return `${name}:\n${values.map((v) => `  - ${yamlValue(v)}`).join('\n')}\n`;
}

function createTaxonomy(dir, entries, kind, languages) {
  let created = 0;
  entries.forEach((entry, index) => {
    if (writeFile(path.join(dir, `${entry.slug}.md`), `---\n${MARKER}\norder: ${index + 1}\n---\n`)) created += 1;
    for (const lang of languages) {
      const title = entry[lang.code];
      if (!title) continue;
      const body = `---\n${MARKER}\ntitle: ${yamlValue(title)}\n---\n\n${taxonomyIntro(lang.code, title)}\n`;
      if (writeFile(path.join(dir, `${entry.slug}.${lang.code}.md`), body)) created += 1;
    }
  });
  if (created > 0) ok(`${kind}: ${plural(entries.length, 'Eintrag', 'Einträge')} angelegt`);
  return created;
}

const PAGE_TEXTS = {
  home: {
    de: {
      headline: 'Schriften, die weitergegeben werden wollen',
      intro:
        'Biblia gibt christliche Flyer heraus. Hier lassen sie sich online lesen, mit einem Klick weitergeben und als gedruckte Ausgabe bestellen.',
      body: '',
    },
    en: {
      headline: 'Leaflets meant to be passed on',
      intro:
        'Biblia publishes Christian leaflets. Here they can be read online, shared in one click and ordered in print.',
      body: '',
    },
  },
  about: {
    de: {
      title: 'Über uns',
      description: 'Wer hinter Biblia steht und wofür der Verein arbeitet.',
      body: 'Biblia ist ein christlicher Verein aus Österreich.\n\nUnser Schwerpunkt liegt auf der Erstellung und Verbreitung gedruckter Schriften. Was hier online zu lesen ist, gibt es auch auf Papier — zum Weitergeben, Auslegen und Verschenken.\n\n> Dies ist ein Beispieltext. Bitte vor der Veröffentlichung ersetzen.',
    },
    en: {
      title: 'About us',
      description: 'Who is behind Biblia and what the association works for.',
      body: 'Biblia is a Christian association based in Austria.\n\nOur focus is on producing and distributing printed leaflets.\n\n> This is placeholder text. Please replace before publishing.',
    },
  },
  imprint: {
    de: {
      title: 'Impressum',
      description: 'Angaben gemäß § 5 ECG und § 25 MedienG.',
      body: '> **Dieser Text muss vor der Veröffentlichung durch die echten Angaben ersetzt werden.**\n\n**Medieninhaber und Herausgeber**\n\nBiblia\nStraße und Hausnummer\nPostleitzahl Ort\nÖsterreich\n\n**Vertretungsberechtigt**\n\nName der vertretungsberechtigten Person\n\n**Kontakt**\n\nE-Mail: kontakt@example.invalid\n\n**Vereinsregister**\n\nZVR-Zahl: 000000000\n\n**Unternehmensgegenstand**\n\nHerausgabe und Verbreitung christlicher Schriften.',
    },
    en: {
      title: 'Imprint',
      description: 'Legal information.',
      body: '> **This text must be replaced with the real details before publishing.**\n\n**Publisher**\n\nBiblia\nStreet and number\nPostal code, city\nAustria',
    },
  },
  privacy: {
    de: {
      title: 'Datenschutz',
      description: 'Wie mit personenbezogenen Daten umgegangen wird.',
      body: '> **Dieser Text muss vor der Veröffentlichung juristisch geprüft und vervollständigt werden.**\n\n## Verantwortlicher\n\nBiblia, Anschrift wie im Impressum.\n\n## Welche Daten verarbeitet werden\n\nDiese Website setzt keine Cookies zu Werbe- oder Analysezwecken ein und bindet keine fremden Dienste ein. Es werden keine Schriften, Karten oder Videos von fremden Servern geladen.\n\nEinstellungen wie Farbschema, Sprache und die persönliche Auswahl werden ausschließlich im Browser gespeichert und nicht übertragen.\n\n## Bestellanfragen und Kontaktformular\n\nWenn Sie eine Bestellanfrage oder eine Nachricht senden, verarbeiten wir die dabei angegebenen Daten, um die Anfrage zu bearbeiten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.\n\n## Speicherdauer\n\nBestellanfragen werden nach zwölf Monaten gelöscht, Kontaktnachrichten nach sechs Monaten.\n\n## Ihre Rechte\n\nSie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei der Datenschutzbehörde.',
    },
    en: {
      title: 'Privacy',
      description: 'How personal data is handled.',
      body: '> **This text must be reviewed and completed before publishing.**\n\nThis website sets no advertising or analytics cookies and embeds no third-party services.',
    },
  },
};

function createPages(home, languages) {
  let created = 0;
  for (const [name, byLang] of Object.entries(PAGE_TEXTS)) {
    if (writeFile(path.join(home.pages, `${name}.md`), `---\n${MARKER}\n---\n`)) created += 1;
    for (const lang of languages) {
      const texts = byLang[lang.code];
      if (!texts) continue;
      let front = `---\n${MARKER}\n`;
      for (const key of ['title', 'description', 'headline', 'intro']) {
        if (texts[key]) front += `${key}: ${yamlValue(texts[key])}\n`;
      }
      front += '---\n';
      if (writeFile(path.join(home.pages, `${name}.${lang.code}.md`), `${front}\n${texts.body ?? ''}\n`)) created += 1;
    }
  }
  if (created > 0) ok(`Seiten: ${plural(Object.keys(PAGE_TEXTS).length, 'Seite', 'Seiten')} angelegt`);
  return created;
}

async function createFlyers(home, config) {
  let created = 0;
  let pdfCount = 0;

  for (const spec of FLYERS) {
    const dirName = `${spec.id}-${spec.slug}`;
    const dir = path.join(home.flyers, dirName);

    let front = `---\n${MARKER}\nid: ${spec.id}\nslug: ${spec.slug}\n`;
    front += `category: ${spec.category}\n`;
    front += yamlList('topics', spec.topics);
    front += yamlList('tags', spec.tags);
    front += yamlList('bible_refs', spec.bibleRefs);
    front += `status: published\ndate: ${spec.date}\n`;
    if (spec.featured) front += `featured: true\nfeatured_order: ${spec.featuredOrder}\n`;
    front += `download: ${spec.download === true}\n`;
    if (spec.folded) {
      front += 'cover:\n  page: 1\n  # Gefalteter Dreitafel-Flyer: das Titelblatt ist das rechte Drittel.\n';
      front += '  crop: { x: 0.6667, y: 0, width: 0.3333, height: 1 }\n';
    }
    front += 'order:\n  enabled: true\n  price: 0\n  currency: EUR\n  min_quantity: 1\n  max_quantity: 100\n';
    front += '---\n';
    if (writeFile(path.join(dir, 'flyer.md'), front)) created += 1;

    for (const [lang, texts] of Object.entries(spec.languages)) {
      if (!config.hasLanguage(lang)) continue;

      let langFront = `---\n${MARKER}\ntitle: ${yamlValue(texts.title)}\n`;
      if (texts.description) langFront += `description: ${yamlValue(texts.description)}\n`;
      if (texts.verseRef) langFront += `bible_verse: ${yamlValue(texts.verse)}\n  \n`.replace('\n  \n', '\n');
      langFront += '---\n';
      if (writeFile(path.join(dir, `flyer.${lang}.md`), `${langFront}\n${texts.body}\n`)) created += 1;

      const pdfFile = path.join(dir, `flyer.${lang}.pdf`);
      if (!fs.existsSync(pdfFile) || force) {
        const bytes = await createDemoPdf({
          title: texts.title,
          verse: texts.verse,
          verseRef: texts.verseRef,
          body: texts.body,
          pages: spec.pages,
          folded: spec.folded,
        });
        fs.writeFileSync(pdfFile, bytes);
        pdfCount += 1;
      }
    }
  }

  if (created > 0 || pdfCount > 0) {
    ok(`Flyer: ${plural(FLYERS.length, 'Flyer', 'Flyer')} angelegt, ${plural(pdfCount, 'PDF erzeugt', 'PDFs erzeugt')}`);
  }
  return created;
}

/** Entfernt alles, was die Markierung trägt. */
function removeDemo(home) {
  let removed = 0;
  const isDemoFile = (file) => {
    try {
      return fs.readFileSync(file, 'utf8').includes(MARKER);
    } catch {
      return false;
    }
  };

  for (const dirName of fs.existsSync(home.flyers) ? fs.readdirSync(home.flyers).sort() : []) {
    const dir = path.join(home.flyers, dirName);
    const marker = path.join(dir, 'flyer.md');
    if (fs.statSync(dir).isDirectory() && fs.existsSync(marker) && isDemoFile(marker)) {
      fs.rmSync(dir, { recursive: true });
      removed += 1;
      info(color.gray(`    entfernt: ${rel(dir)}`));
    }
  }

  for (const dir of [home.pages, home.topics, home.categories]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isFile() && isDemoFile(file)) {
        fs.unlinkSync(file);
        removed += 1;
      }
    }
  }
  return removed;
}

runMain(async () => {
  const home = resolveHome();
  const config = loadConfig({ home });

  if (remove) {
    heading('Beispielinhalte entfernen');
    const removed = removeDemo(home);
    blank();
    if (removed === 0) ok('Es waren keine Beispielinhalte vorhanden.');
    else ok(`${plural(removed, 'Eintrag entfernt', 'Einträge entfernt')}.`);
    blank();
    return 0;
  }

  heading('Beispielinhalte anlegen');
  info(color.gray('    Nur zum Entwickeln und Ausprobieren. Entfernen mit:  npm run demo -- --remove'));
  blank();

  const existing = fs.existsSync(home.flyers) ? fs.readdirSync(home.flyers).filter((n) => !n.startsWith('.')) : [];
  if (existing.length > 0 && !force) {
    warn('Es sind bereits Flyer vorhanden — bestehende Dateien bleiben unverändert.');
    info(color.gray('    Überschreiben mit:  npm run demo -- --force'));
    blank();
  }

  step('Kategorien und Themen');
  createTaxonomy(home.categories, CATEGORIES, 'Kategorien', config.activeLanguages);
  createTaxonomy(home.topics, TOPICS, 'Themen', config.activeLanguages);

  step('Seiten');
  createPages(home, config.activeLanguages);

  step('Flyer und PDFs');
  await createFlyers(home, config);

  blank();
  ok('Fertig.');
  info(color.gray('    Nächster Schritt:  npm run check'));
  blank();
  return 0;
});
