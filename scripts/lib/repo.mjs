/**
 * Welches Git-Repository ist hier eigentlich gemeint?
 *
 * Seit Inhalte und Werkzeug getrennt sind, gibt es zwei — und Git sucht von
 * sich aus nach oben weiter. Ein Inhaltsordner, der versehentlich innerhalb
 * eines anderen Repositories liegt, liefert deshalb klaglos dessen
 * Versionsgeschichte zurück: "git log -- content/flyers" ergibt dann eine
 * leere Ausgabe statt eines Fehlers.
 *
 * Genau daran hängen aber zwei Zusagen dieses Projekts: dass eine einmal
 * vergebene Nummer nie verschwindet, und dass ein umbenannter Flyer eine
 * Weiterleitung bekommt. Beide würden lautlos aufhören zu gelten.
 *
 * Deshalb wird nie einfach gefragt, ob Git etwas zurückgibt, sondern immer,
 * ob es das richtige Repository ist.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Die Wurzel des Repositories, zu dem dieses Verzeichnis gehört.
 * @returns {string|null} Aufgelöster Pfad, oder null wenn es keines gibt.
 */
export function repositoryRoot(dir) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return top === '' ? null : fs.realpathSync(top);
  } catch {
    return null;
  }
}

/** Ist dieses Verzeichnis selbst die Wurzel eines Repositories? */
export function isRepositoryRoot(dir) {
  const top = repositoryRoot(dir);
  if (top === null) return false;
  try {
    return top === fs.realpathSync(dir);
  } catch {
    return false;
  }
}
