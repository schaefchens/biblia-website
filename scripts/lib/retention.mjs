/**
 * Die Regeln hinter "npm run retention".
 *
 * Bewusst als eigenes Modul: an diesen drei Funktionen hängt, ob
 * personenbezogene Daten wirklich verschwinden. Sie sollen einzeln
 * prüfbar sein, ohne eine Verbindung zum Server aufzubauen.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ist dieser Eintrag abgelaufen oder betrifft er die gesuchte Person?
 *
 * @param {string} contents   Inhalt der JSON-Datei
 * @param {number} maxAgeDays Aufbewahrungsfrist in Tagen
 * @param {string|null} searchTerm Name oder E-Mail bei einem Löschersuchen
 * @param {number} [now]      Zeitpunkt des Vergleichs
 */
export function shouldRemove(contents, maxAgeDays, searchTerm, now = Date.now()) {
  let record;
  try {
    record = JSON.parse(contents);
  } catch {
    return { remove: false };
  }
  if (!record || typeof record !== 'object') return { remove: false };

  if (searchTerm) {
    const haystack = JSON.stringify(record.contact ?? {}).toLowerCase();
    if (haystack.includes(searchTerm.toLowerCase())) {
      return { remove: true, reason: 'Löschersuchen' };
    }
  }

  const created = Date.parse(record.created_at ?? '');
  if (!Number.isFinite(created)) return { remove: false };
  const ageDays = (now - created) / 86_400_000;
  if (ageDays > maxAgeDays) {
    return { remove: true, reason: `${Math.floor(ageDays)} Tage alt` };
  }
  return { remove: false };
}

/**
 * Alle .json-Dateien unterhalb eines lokalen Verzeichnisses.
 * Auch in Unterverzeichnissen — ein Eintrag im Archiv ist trotzdem gespeichert.
 */
export function listLocalRecords(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listLocalRecords(path.join(dir, entry.name), relative));
    else if (entry.name.endsWith('.json')) out.push(relative);
  }
  return out;
}

/**
 * Alle .json-Dateien unterhalb eines Verzeichnisses auf dem Server.
 *
 * "npm run fetch -- --archive" verschiebt abgeholte Einträge nach archiv/.
 * Würde nur das oberste Verzeichnis durchsucht, blieben genau diese
 * Einträge für immer liegen.
 *
 * @returns {Promise<{files: string[], unreadable: string[]}>}
 */
export async function listRemoteRecords(client, dir, prefix = '') {
  let entries;
  try {
    entries = await client.list(dir);
  } catch {
    // Das oberste Verzeichnis darf fehlen — dann gibt es dort noch nichts.
    // Ein Unterverzeichnis, das sich nicht lesen lässt, ist ein Problem.
    return { files: [], unreadable: prefix === '' ? [] : [dir] };
  }

  const files = [];
  const unreadable = [];
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.' || entry.name === '..') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.type === 'd') {
      const nested = await listRemoteRecords(client, `${dir}/${entry.name}`, relative);
      files.push(...nested.files);
      unreadable.push(...nested.unreadable);
    } else if (entry.type === '-' && entry.name.endsWith('.json')) {
      files.push(relative);
    }
  }
  return { files, unreadable };
}
