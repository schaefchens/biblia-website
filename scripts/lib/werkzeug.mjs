/**
 * Der Stand des Werkzeugs im Inhaltsordner.
 *
 * Das Werkzeug liegt als Git-Submodul unter werkzeug/. Der Inhaltsordner
 * hält fest, welcher Stand gelten soll — und genau das ist die Stelle, an
 * der ein Submodul stillschweigend auseinanderläuft:
 *
 *   · "git clone" ohne --recurse-submodules lässt werkzeug/ leer,
 *   · "git pull" holt den neuen Stand der Inhalte, aber nicht den des
 *     Submoduls.
 *
 * Beides sieht man dem Ordner nicht an. Deshalb wird es geprüft und
 * benannt, statt sich darauf zu verlassen, dass alle daran denken.
 *
 * Hier wird nur Text ausgewertet; Git aufgerufen wird in doctor.mjs und
 * publish.mjs. So lässt sich die Auswertung ohne Repository prüfen.
 */

/**
 * Wertet eine Zeile von "git submodule status" aus.
 *
 * Das erste Zeichen sagt alles:
 *   " "  eingerichtet und auf dem festgehaltenen Stand
 *   "-"  nicht eingerichtet — das Verzeichnis ist leer
 *   "+"  eingerichtet, aber auf einem anderen Stand
 *   "U"  Konflikt beim Zusammenführen
 *
 * @returns {{state:'ok'|'missing'|'moved'|'conflict'|'unknown', sha:string|null, path:string|null, describe:string|null}}
 */
export function parseSubmoduleStatus(output) {
  const line = String(output ?? '')
    .split('\n')
    .find((entry) => entry.trim() !== '');

  if (!line) return { state: 'unknown', sha: null, path: null, describe: null };

  const marker = line[0];
  const state =
    marker === ' ' ? 'ok'
    : marker === '-' ? 'missing'
    : marker === '+' ? 'moved'
    : marker === 'U' ? 'conflict'
    : 'unknown';

  // " <sha> <pfad> (<beschreibung>)" — die Beschreibung fehlt, solange das
  // Submodul nicht eingerichtet ist.
  const match = /^.(\S+)\s+(\S+)(?:\s+\((.+)\))?\s*$/.exec(line);
  if (!match) return { state, sha: null, path: null, describe: null };

  return { state, sha: match[1], path: match[2], describe: match[3] ?? null };
}

/** Meldung und Hinweis zu einem Zustand — in beiden Befehlen dieselbe Sprache. */
export function describeSubmoduleState(status, { dir = 'werkzeug' } = {}) {
  switch (status.state) {
    case 'ok':
      return {
        level: 'ok',
        message: `Werkzeug auf dem festgehaltenen Stand${status.describe ? ` (${status.describe})` : ''}`,
      };
    case 'missing':
      return {
        level: 'problem',
        message: `Das Werkzeug unter ${dir}/ ist nicht eingerichtet.`,
        hint:
          'Beim Klonen wurde --recurse-submodules vergessen. Einmalig nachholen:\n' +
          '      git submodule update --init\n' +
          `      cd ${dir} && npm ci && cd ..`,
      };
    case 'moved':
      return {
        level: 'problem',
        message: `Das Werkzeug steht auf einem anderen Stand als festgehalten${status.describe ? ` (${status.describe})` : ''}.`,
        hint:
          'Damit wird die Website mit einer anderen Fassung erzeugt als vorgesehen.\n' +
          '      Auf den festgehaltenen Stand zurück:\n' +
          '      git submodule update',
      };
    case 'conflict':
      return {
        level: 'problem',
        message: `Beim Werkzeug unter ${dir}/ gibt es einen ungelösten Konflikt.`,
        hint: 'Zuerst den Konflikt auflösen:  git submodule update',
      };
    default:
      return {
        level: 'hint',
        message: 'Der Stand des Werkzeugs lässt sich nicht feststellen.',
        hint: `Erwartet wird ein Submodul unter ${dir}/. Ist der Inhaltsordner ein Git-Repository?`,
      };
  }
}
