/**
 * Liest Markdown-Dateien mit YAML-Kopf.
 *
 * YAML ist die häufigste Fehlerquelle für die Mitarbeiter. Deshalb werden
 * Fehler hier mit Datei, Zeilennummer und einem konkreten Hinweis gemeldet,
 * nicht als technische Ausnahme weitergereicht.
 */
import fs from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { rel } from './paths.mjs';

/** Fehler in einer Inhaltsdatei, mit Ort und Hilfestellung. */
export class ContentError extends Error {
  constructor({ file, line, message, hint }) {
    super(message);
    this.name = 'ContentError';
    this.file = file;
    this.line = line;
    this.hint = hint;
  }
  /** Einzeiler für die Ausgabe in npm run check. */
  get location() {
    return this.line ? `${rel(this.file)}:${this.line}` : rel(this.file);
  }
}

const FENCE = /^---\r?\n/;

/**
 * Häufige YAML-Stolperfallen in eine verständliche Erklärung übersetzen.
 * Die Meldungen von js-yaml sind für Nicht-Entwickler unbrauchbar.
 */
function explainYamlError(message, sourceLine, headerLines = []) {
  const text = (sourceLine ?? '').trim();

  // Ein unmaskierter Doppelpunkt im Wert ist der mit Abstand häufigste Fehler
  // ("title: Wer ist Jesus: der Weg"). js-yaml meldet dafür dasselbe wie für
  // echte Einrückungsfehler, deshalb wird hier die Quellzeile ausgewertet.
  const unquotedColon = /^([A-Za-z_][\w-]*)\s*:\s*(?!["'|>])(\S.*:.*)$/.exec(text);
  if (unquotedColon && /mapping values are not allowed|bad indentation/i.test(message)) {
    const [, key, value] = unquotedColon;
    return {
      message: 'Der Wert enthält einen Doppelpunkt und muss deshalb in Anführungszeichen stehen.',
      hint: `Schreibe stattdessen:  ${key}: "${value.trim()}"`,
    };
  }

  if (/mapping values are not allowed/i.test(message)) {
    return {
      message: 'An dieser Stelle ist ein Doppelpunkt nicht erlaubt.',
      hint: 'Werte, die einen Doppelpunkt enthalten, immer in "Anführungszeichen" setzen.',
    };
  }

  // Nicht geschlossenes Anführungszeichen — irgendwo im Kopf, nicht unbedingt
  // in der Zeile, die js-yaml meldet.
  const odd = (line, quote) => (line.match(new RegExp(quote, "g")) ?? []).length % 2 === 1;
  const unbalanced = [text, ...headerLines].find((line) => odd(line, '"') || odd(line, "'"));
  if (unbalanced) {
    return {
      message: 'Ein Anführungszeichen wurde geöffnet, aber nicht geschlossen.',
      hint: `Prüfe diese Zeile:  ${unbalanced.trim()}`,
      line: headerLines.indexOf(unbalanced) >= 0 ? headerLines.indexOf(unbalanced) + 2 : undefined,
    };
  }
  if (/duplicated mapping key/i.test(message)) {
    return {
      message: 'Dieser Eintrag kommt zweimal vor.',
      hint: 'Jeder Name darf im Kopf der Datei nur einmal stehen. Die zweite Zeile löschen.',
    };
  }
  if (/bad indentation|incomplete explicit mapping/i.test(message)) {
    return {
      message: 'Die Einrückung stimmt nicht.',
      hint: 'Immer Leerzeichen verwenden, niemals Tabulatoren, und untergeordnete Zeilen um zwei Leerzeichen einrücken.',
    };
  }
  if (/unexpected end of the stream|unexpected end of stream/i.test(message)) {
    return {
      message: 'Ein Anführungszeichen oder eine Klammer wurde nicht geschlossen.',
      hint: 'Prüfe, ob jedes " und jede [ auch wieder geschlossen wird.',
    };
  }
  if (/tab character/i.test(message)) {
    return {
      message: 'Die Datei enthält einen Tabulator.',
      hint: 'YAML erlaubt keine Tabulatoren. Ersetze sie durch Leerzeichen.',
    };
  }
  return { message: `Der Kopf der Datei konnte nicht gelesen werden: ${message}`, hint: null };
}

/**
 * Liest eine Markdown-Datei mit optionalem YAML-Kopf.
 * @returns {{ data: object, body: string, file: string }}
 */
export function readMarkdownFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new ContentError({ file, message: 'Die Datei konnte nicht gelesen werden.' });
  }

  // macOS speichert Umlaute zerlegt, Windows und Linux zusammengesetzt.
  // Ohne Normalisierung sind identische Texte auf verschiedenen Rechnern
  // nicht gleich, was Suche, Vergleiche und den Zwischenspeicher stört.
  text = text.normalize('NFC').replace(/^\uFEFF/, '');

  if (!FENCE.test(text)) {
    return { data: {}, body: text.trim(), file };
  }

  const rest = text.replace(FENCE, '');
  const end = rest.search(/^---\s*$/m);
  if (end === -1) {
    throw new ContentError({
      file,
      line: 1,
      message: 'Der Kopf der Datei wurde nicht geschlossen.',
      hint: 'Nach den Angaben muss eine Zeile mit genau drei Bindestrichen folgen: ---',
    });
  }

  const header = rest.slice(0, end);
  const body = rest.slice(end).replace(/^---\s*\r?\n?/, '');

  let data;
  try {
    data = loadYaml(header, { filename: file }) ?? {};
  } catch (err) {
    const line = (err.mark?.line ?? 0) + 2; // +1 für die "---"-Zeile, +1 weil 0-basiert
    const sourceLine = header.split(/\r?\n/)[err.mark?.line ?? 0];
    const headerLines = header.split(/\r?\n/);
    const explained = explainYamlError(err.reason ?? err.message, sourceLine, headerLines);
    throw new ContentError({ file, line, ...explained, line: explained.line ?? line });
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ContentError({
      file,
      line: 2,
      message: 'Der Kopf der Datei muss aus Name-Wert-Paaren bestehen.',
      hint: 'Zum Beispiel:  title: Hoffnung',
    });
  }

  return { data, body: body.trim(), file };
}
