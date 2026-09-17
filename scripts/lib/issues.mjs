/**
 * Sammelt Probleme in den Inhalten, statt beim ersten Fehler abzubrechen.
 *
 * Die Mitarbeiter sollen in einem Durchgang alles sehen, was zu korrigieren
 * ist — nicht nach jeder Korrektur den nächsten Fehler einzeln entdecken.
 */

export const LEVEL = { ERROR: 'error', WARNING: 'warning' };

export class Issues {
  constructor() {
    this.items = [];
  }

  /**
   * @param {object} issue
   * @param {string} issue.level    'error' oder 'warning'
   * @param {string} issue.subject  Worum geht es — z. B. "123-hope" oder "Startseite"
   * @param {string} issue.message  Was stimmt nicht
   * @param {string} [issue.hint]   Was zu tun ist
   * @param {string} [issue.file]   Betroffene Datei
   * @param {number} [issue.line]   Zeile in dieser Datei
   */
  add(issue) {
    this.items.push({ hint: null, file: null, line: null, ...issue });
    return this;
  }

  error(subject, message, extra = {}) {
    return this.add({ level: LEVEL.ERROR, subject, message, ...extra });
  }

  warning(subject, message, extra = {}) {
    return this.add({ level: LEVEL.WARNING, subject, message, ...extra });
  }

  /** Übernimmt einen ContentError aus dem Dateileser. */
  fromContentError(subject, err) {
    return this.error(subject, err.message, { hint: err.hint, file: err.file, line: err.line });
  }

  get errors() {
    return this.items.filter((i) => i.level === LEVEL.ERROR);
  }

  get warnings() {
    return this.items.filter((i) => i.level === LEVEL.WARNING);
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  /** Gruppiert nach Betreff, damit die Ausgabe pro Flyer zusammenhängt. */
  groupedBySubject() {
    const groups = new Map();
    for (const item of this.items) {
      if (!groups.has(item.subject)) groups.set(item.subject, []);
      groups.get(item.subject).push(item);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
  }
}
