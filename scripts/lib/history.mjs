/**
 * Was die Versionsgeschichte über die Adressen sagt.
 *
 * Die Inhalte für sich sind nach einer Umbenennung widerspruchsfrei — dass
 * ein Flyer früher anders hiess oder eine andere Nummer hatte, weiss nur
 * Git. Ohne diese Auswertung bräche eine Umbenennung stillschweigend jeden
 * gedruckten QR-Code und jeden geteilten Link.
 *
 * Die Funktionen hier werten nur Text aus; das Aufrufen von Git bleibt in
 * scripts/check.mjs. Dadurch sind sie einzeln prüfbar.
 */
import path from 'node:path';

/** Zeile aus "git log --diff-filter=R --name-status -M". */
const RENAME_LINE =
  /^R\d*\t(content\/flyers\/[^/]+)\/flyer\.md\t(content\/flyers\/[^/]+)\/flyer\.md$/;

/** Verzeichnisname eines Flyers: <Nummer>-<kurzname>. */
const FLYER_PATH = /^content\/flyers\/(\d+)-[^/]*\//;

/**
 * Umbenannte Flyer-Ordner.
 *
 * @param {string} gitOutput Ausgabe von git log --diff-filter=R --name-status
 * @returns {Array<{oldId: number|null, oldSlug: string, newDir: string}>}
 */
export function parseRenames(gitOutput) {
  const renames = [];
  for (const line of String(gitOutput).split('\n')) {
    const match = RENAME_LINE.exec(line.trim());
    if (!match) continue;
    const oldDir = path.basename(match[1]);
    const oldId = /^(\d+)-/.exec(oldDir)?.[1] ?? null;
    renames.push({
      oldId: oldId === null ? null : Number(oldId),
      oldSlug: oldDir.replace(/^\d+-/, ''),
      newDir: path.basename(match[2]),
    });
  }
  return renames;
}

/**
 * Jede Nummer, die es in diesem Projekt je gegeben hat.
 *
 * @param {string} gitOutput Ausgabe von git log --name-only
 * @returns {Set<number>}
 */
export function parseHistoricIds(gitOutput) {
  const ids = new Set();
  for (const line of String(gitOutput).split('\n')) {
    const match = FLYER_PATH.exec(line.trim());
    if (match) ids.add(Number(match[1]));
  }
  return ids;
}

/**
 * Nummern, die es einmal gab und heute nicht mehr gibt.
 *
 * Genau das darf nie passieren: /f/123/ steht auf gedruckten Flyern.
 *
 * @param {Set<number>} historic
 * @param {Map<number, object>|Set<number>} current
 * @param {number[]} [retired] Ausdrücklich zurückgezogene Nummern
 */
export function vanishedIds(historic, current, retired = []) {
  const stillRetired = new Set(retired.map(Number));
  return [...historic]
    .filter((id) => !current.has(id) && !stillRetired.has(id))
    .sort((a, b) => a - b);
}
