/**
 * Liest sftp.env, ohne die Werte nach process.env zu schreiben.
 *
 * Absichtlich kein Paket und kein process.loadEnvFile(): das Passwort soll
 * nicht in der Umgebung landen und damit auch nicht an Unterprozesse
 * (z. B. git oder php) vererbt werden.
 */
import fs from 'node:fs';

/** Parst den Inhalt einer .env-Datei zu einem Objekt. */
export function parseEnv(text) {
  const values = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Liest eine .env-Datei. Fehlt sie, kommt ein leeres Objekt zurück. */
export function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return parseEnv(fs.readFileSync(file, 'utf8'));
}

/** Verdeckt einen Wert für die Ausgabe auf der Kommandozeile. */
export function maskSecret(value) {
  if (!value) return '(leer)';
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-2)}`;
}
