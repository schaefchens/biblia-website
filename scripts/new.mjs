/**
 * npm run new
 *
 * Legt einen neuen Flyer an — Schritt für Schritt, ohne Vorwissen.
 *
 * Am Ende steht ein fertiger Ordner unter content/flyers/ mit allen
 * Dateien, die der Build erwartet.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { resolveHome, rel } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { loadContent } from './lib/content.mjs';
import { blank, color, heading, info, ok, runMain, warn } from './lib/log.mjs';

/** Macht aus einem Titel einen Kurznamen für die Adresse. */
export function slugify(text) {
  return (
    String(text)
      // Zuerst zusammensetzen, damit die Umlaute als ein Zeichen vorliegen.
      .normalize('NFC')
      // Deutsche Umlaute vor allem anderen ersetzen. Andernfalls würde die
      // Zerlegung weiter unten aus "Über" ein "uber" machen statt des
      // üblichen "ueber".
      .replace(/ß/g, 'ss')
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      // Alle übrigen Akzente entfernen (é, à, ç …).
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
  );
}

/** Text so schreiben, dass YAML ihn sicher wieder einliest. */
function yamlValue(text) {
  return /^[A-Za-z0-9][A-Za-z0-9 .,_-]*$/.test(text) ? text : JSON.stringify(text);
}

runMain(async () => {
  const home = resolveHome();
  const config = loadConfig({ home });
  const content = loadContent(config, { dirs: home });

  heading('Neuen Flyer anlegen');
  info(color.gray('    Mit Strg+C jederzeit abbrechen. Es wird erst ganz am Ende etwas geschrieben.'));
  blank();

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    // --- Titel ---
    let title = '';
    while (title === '') {
      title = (await rl.question('Titel des Flyers:\n> ')).trim();
      if (title === '') warn('Bitte einen Titel eingeben.');
    }

    // --- Sprache ---
    blank();
    const languages = config.activeLanguages;
    info('Sprache:');
    languages.forEach((language, index) => info(color.gray(`    ${index + 1}) ${language.label}`)));
    const languageAnswer = (await rl.question(`> [1-${languages.length}, Standard 1] `)).trim();
    const language = languages[Number(languageAnswer || '1') - 1] ?? languages[0];

    // --- Kategorie ---
    blank();
    const categories = [...content.categories.keys()].sort();
    let category = null;
    if (categories.length > 0) {
      info('Kategorie:');
      categories.forEach((slug, index) => {
        const label = content.categories.get(slug).languages[language.code]?.title ?? slug;
        info(color.gray(`    ${index + 1}) ${label}  (${slug})`));
      });
      const answer = (await rl.question(`> [1-${categories.length}] `)).trim();
      category = categories[Number(answer) - 1] ?? null;
      if (!category) warn('Keine gültige Auswahl — die Kategorie kann später in flyer.md ergänzt werden.');
    } else {
      warn('Es sind noch keine Kategorien angelegt.');
    }

    // --- Themen ---
    blank();
    const topics = [...content.topics.keys()].sort();
    let chosenTopics = [];
    if (topics.length > 0) {
      info('Themen (mehrere durch Komma trennen, leer lassen für keine):');
      info(color.gray(`    ${topics.join(', ')}`));
      const answer = (await rl.question('> ')).trim();
      chosenTopics = answer
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => topics.includes(entry));
    }

    // --- PDF ---
    blank();
    info('Pfad zur PDF-Datei (leer lassen, um sie später zu kopieren):');
    const pdfAnswer = (await rl.question('> ')).trim().replace(/^["']|["']$/g, '');
    let pdfSource = null;
    if (pdfAnswer !== '') {
      const candidate = path.resolve(pdfAnswer);
      if (!fs.existsSync(candidate)) warn(`Die Datei wurde nicht gefunden: ${candidate}`);
      else if (!candidate.toLowerCase().endsWith('.pdf')) warn('Das ist keine PDF-Datei.');
      else pdfSource = candidate;
    }

    // --- Zusammenfassen ---
    const slug = slugify(title);
    const nextId = Math.max(100, ...content.flyers.map((flyer) => flyer.id)) + 1;
    const dirName = `${nextId}-${slug}`;
    const target = path.join(home.flyers, dirName);

    if (slug === '') {
      warn('Aus dem Titel liess sich kein Kurzname bilden.');
      return 1;
    }
    if (fs.existsSync(target)) {
      warn(`Der Ordner ${rel(target)} gibt es bereits.`);
      return 1;
    }

    blank();
    heading('Zusammenfassung');
    info(`Titel:     ${title}`);
    info(`Nummer:    ${nextId}   ${color.gray('(bleibt dauerhaft — gedruckte QR-Codes verweisen darauf)')}`);
    info(`Ordner:    ${rel(target)}`);
    info(`Sprache:   ${language.label}`);
    info(`Kategorie: ${category ?? color.gray('(noch offen)')}`);
    info(`Themen:    ${chosenTopics.join(', ') || color.gray('(keine)')}`);
    info(`PDF:       ${pdfSource ? rel(pdfSource) : color.gray('(später kopieren)')}`);
    blank();

    const confirm = (await rl.question('So anlegen? [J/n] ')).trim().toLowerCase();
    if (confirm !== '' && confirm !== 'j' && confirm !== 'ja' && confirm !== 'y') {
      blank();
      info('Abgebrochen. Es wurde nichts angelegt.');
      blank();
      return 0;
    }

    // --- Anlegen ---
    fs.mkdirSync(target, { recursive: true });

    let shared = `---\nid: ${nextId}\nslug: ${slug}\n`;
    if (category) shared += `category: ${category}\n`;
    if (chosenTopics.length > 0) shared += `topics:\n${chosenTopics.map((topic) => `  - ${topic}`).join('\n')}\n`;
    shared += 'tags: []\n';
    shared += 'bible_refs: []\n';
    shared += '# Entwurf. Auf "published" setzen, sobald der Flyer erscheinen soll.\n';
    shared += 'status: draft\n';
    shared += `date: ${new Date().toISOString().slice(0, 10)}\n`;
    shared += 'featured: false\n';
    shared += '# Auf true setzen, wenn die PDF-Datei zum Herunterladen angeboten werden soll.\n';
    shared += 'download: false\n';
    shared += 'order:\n  enabled: true\n  price: 0\n  currency: EUR\n  min_quantity: 1\n  max_quantity: 100\n';
    shared += '---\n';
    fs.writeFileSync(path.join(target, 'flyer.md'), shared);

    const languageFile =
      `---\ntitle: ${yamlValue(title)}\n` +
      `description: ""   # Ein bis zwei Sätze. Erscheint in der Übersicht und beim Teilen.\n---\n\n` +
      `Hier kann ein längerer Text zum Flyer stehen. Er erscheint auf der Detailseite.\n`;
    fs.writeFileSync(path.join(target, `flyer.${language.code}.md`), languageFile);

    if (pdfSource) {
      fs.copyFileSync(pdfSource, path.join(target, `flyer.${language.code}.pdf`));
    }

    blank();
    ok(`Angelegt: ${rel(target)}`);
    blank();
    info('Nächste Schritte:');
    info(color.gray(`    1. ${rel(path.join(target, `flyer.${language.code}.md`))} öffnen und die Beschreibung ergänzen`));
    if (!pdfSource) {
      info(color.gray(`    2. Die PDF-Datei als flyer.${language.code}.pdf in den Ordner kopieren`));
      info(color.gray('    3. In flyer.md  status: draft  auf  status: published  ändern'));
      info(color.gray('    4. npm run check'));
    } else {
      info(color.gray('    2. In flyer.md  status: draft  auf  status: published  ändern'));
      info(color.gray('    3. npm run check'));
    }
    blank();
    return 0;
  } finally {
    rl.close();
  }
});
