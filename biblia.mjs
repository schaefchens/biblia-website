/**
 * Der Einstieg für alle Befehle dieses Inhaltsordners.
 *
 * Diese Datei gehört zum Inhaltsordner, nicht zum Werkzeug — und das ist
 * ihr ganzer Zweck: sie funktioniert auch dann noch, wenn das Werkzeug
 * fehlt. Genau das ist der häufigste Fehler beim Einrichten:
 *
 *   git clone <adresse>          ← ohne --recurse-submodules
 *
 * Danach ist werkzeug/ leer. Ohne diese Datei bekäme man als Antwort
 * "Cannot find module" und einen Stapel englischer Zeilen — mit ihr eine
 * Anweisung.
 *
 * Sie reicht ausserdem den Pfad dieses Ordners als --home weiter, damit das
 * Werkzeug ihn nicht suchen muss.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const home = path.dirname(fileURLToPath(import.meta.url));
const werkzeug = path.join(home, 'werkzeug');
const scripts = path.join(werkzeug, 'scripts');

const [command, ...rest] = process.argv.slice(2);

function stop(message, ...hints) {
  process.stdout.write(`\n[31m✗[0m ${message}\n\n`);
  for (const hint of hints) process.stdout.write(`  ${hint}\n`);
  process.stdout.write('\n');
  process.exit(1);
}

if (!command) {
  stop('Es fehlt der Name des Befehls.', 'Zum Beispiel:  npm run check');
}

if (!fs.existsSync(scripts)) {
  stop(
    'Das Werkzeug fehlt — der Ordner werkzeug/ ist leer.',
    'Beim Holen wurde --recurse-submodules vergessen.',
    'Einmalig nachholen:',
    '',
    '    git submodule update --init',
    '    npm run setup',
    '',
  );
}

const file = path.join(scripts, `${command}.mjs`);
if (!fs.existsSync(file)) {
  stop(
    `Diesen Befehl gibt es nicht: ${command}`,
    'Die verfügbaren Befehle stehen in der README.md.',
  );
}

if (!fs.existsSync(path.join(werkzeug, 'node_modules'))) {
  stop(
    'Dem Werkzeug fehlen die Programmbibliotheken.',
    'Einmalig ausführen:',
    '',
    '    npm run setup',
    '',
  );
}

// --home ausdrücklich: so hängt nichts daran, aus welchem Verzeichnis
// heraus der Befehl gestartet wurde.
const result = spawnSync(process.execPath, [file, ...rest, '--home', home], {
  cwd: home,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
