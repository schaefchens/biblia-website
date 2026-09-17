/**
 * npm run doctor
 *
 * Prüft, ob dieser Rechner alles hat, was zum Arbeiten nötig ist,
 * und ob das Projekt sauber eingerichtet ist.
 *
 * Läuft absichtlich auch dann, wenn noch nichts installiert ist,
 * und erklärt dann, was zu tun ist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { SYS, WERKZEUG_DIR, findHome, rel } from './lib/paths.mjs';
import { parseSubmoduleStatus, describeSubmoduleState } from './lib/werkzeug.mjs';
import { repositoryRoot } from './lib/repo.mjs';
import { readEnvFile, maskSecret } from './lib/env.mjs';
import { blank, color, formatBytes, heading, info, ok, warn, error, runMain, plural } from './lib/log.mjs';

const require = createRequire(import.meta.url);

const results = { ok: 0, warn: 0, error: 0 };

function pass(text, extra) {
  results.ok += 1;
  ok(extra ? `${text} ${color.gray(extra)}` : text);
}
function hint(text, advice) {
  results.warn += 1;
  warn(text);
  if (advice) info(color.gray(advice));
}
function problem(text, advice) {
  results.error += 1;
  error(text);
  if (advice) info(color.gray(advice));
}

/** Führt ein Kommando aus und meldet nur, ob es erfolgreich war. */
function succeeds(command, args, cwd = SYS.root) {
  try {
    execFileSync(command, args, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Führt ein Kommando aus und gibt die Ausgabe zurück, oder null bei Fehler. */
function run(command, args, { raw = false, ...options } = {}) {
  try {
    const output = execFileSync(command, args, {
      cwd: SYS.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options,
    });
    // raw: bei "git submodule status" trägt das führende Leerzeichen
    // Bedeutung — beschneiden würde die Aussage verlieren.
    return raw ? output : output.trim();
  } catch {
    return null;
  }
}

function checkNode() {
  heading('Node.js');
  const current = process.versions.node;
  const required = JSON.parse(fs.readFileSync(SYS.packageJson, 'utf8')).engines.node;
  const min = required.replace(/[^0-9.]/g, '').split('.').map(Number);
  const have = current.split('.').map(Number);
  const tooOld =
    have[0] < min[0] || (have[0] === min[0] && (have[1] < (min[1] ?? 0)));
  if (tooOld) {
    problem(
      `Node.js ${current} ist zu alt (benötigt wird ${required}).`,
      'Aktuelle Version von https://nodejs.org installieren und das Terminal neu öffnen.',
    );
  } else {
    pass(`Node.js ${current}`, `(benötigt ${required})`);
  }
}

function checkDependencies() {
  heading('Programmbibliotheken');
  if (!fs.existsSync(path.join(SYS.root, 'node_modules'))) {
    problem(
      'Die Programmbibliotheken sind noch nicht installiert.',
      'Einmalig im Projektordner ausführen:  npm ci',
    );
    return;
  }

  // Die drei Module mit plattformabhängigen Binärdateien sind die einzigen,
  // die auf einem anderen Betriebssystem stillschweigend fehlen können.
  const native = [
    ['sharp', 'Bildverarbeitung'],
    ['@napi-rs/canvas', 'Bild- und Textkomposition'],
    ['esbuild', 'CSS und JavaScript bündeln'],
  ];
  for (const [name, purpose] of native) {
    try {
      require.resolve(name);
      pass(`${name}`, `— ${purpose}`);
    } catch {
      problem(
        `${name} lässt sich nicht laden (${purpose}).`,
        'Meist hilft:  npm ci   — wenn nicht, node_modules löschen und erneut npm ci ausführen.',
      );
    }
  }

  const plain = ['pdfjs-dist', 'js-yaml', 'markdown-it', 'qrcode', 'ssh2-sftp-client', 'pdf-lib'];
  const missing = plain.filter((name) => {
    try {
      require.resolve(`${name}/package.json`);
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length === 0) pass(`Alle weiteren Bibliotheken vorhanden`, `(${plain.length})`);
  else problem(`Diese Bibliotheken fehlen: ${missing.join(', ')}`, 'Ausführen:  npm ci');

  const fonts = ['@fontsource-variable/source-serif-4', '@fontsource-variable/inter'];
  const missingFonts = fonts.filter((name) => {
    try {
      require.resolve(`${name}/package.json`);
      return false;
    } catch {
      return true;
    }
  });
  if (missingFonts.length === 0) {
    pass('Schriften vorhanden', '— nötig für die Teilen-Bilder');
  } else {
    problem(
      `Schriften fehlen: ${missingFonts.join(', ')}`,
      'Ohne sie sehen die Bilder zum Teilen auf jedem Rechner anders aus. Ausführen:  npm ci',
    );
  }
}

async function checkConfig(home) {
  heading('Konfiguration');
  let config;
  try {
    const { loadConfig } = await import('./lib/config.mjs');
    config = loadConfig({ home });
  } catch (err) {
    problem(err.message, err.hint);
    return null;
  }
  pass('config/site.json ist gültig');
  pass(`Adresse: ${config.baseUrl}`);
  info(
    color.gray(
      config.basePath === '/'
        ? '    Die Website liegt im Hauptverzeichnis.'
        : `    Die Website liegt im Unterverzeichnis ${config.basePath} — alle Adressen enthalten dieses Präfix.`,
    ),
  );
  pass(`Sprachen: ${config.activeLanguages.map((l) => `${l.label} (${l.code})`).join(', ')}`);

  if (config.isStaging) {
    hint(
      `Test-Adresse aktiv — die endgültige Domain wäre ${config.canonicalDomain}.`,
      'Solange das so ist: Suchmaschinen werden ausgesperrt, Bestellungen laufen im Testmodus, ' +
        'und QR-Codes für den Druck werden als "NICHT DRUCKEN" gekennzeichnet.',
    );
  } else {
    pass('Die Website läuft unter ihrer endgültigen Domain.');
  }
  return config;
}

function checkDeployConfig(home) {
  heading('Zugangsdaten für das Hochladen');
  if (!fs.existsSync(home.sftpEnv)) {
    hint(
      'Die Datei sftp.env fehlt.',
      `Kopiere ${rel(home.sftpEnvExample)} zu sftp.env und trage die Zugangsdaten ein. ` +
        'Ohne sie funktionieren npm run deploy und npm run fetch nicht.',
    );
    return;
  }
  const env = readEnvFile(home.sftpEnv);
  const required = ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_REMOTE_ROOT'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    problem(`In sftp.env fehlen: ${missing.join(', ')}`);
  } else {
    pass(`Server: ${env.SFTP_USER}@${env.SFTP_HOST}:${env.SFTP_PORT || 22}`);
    pass(`Passwort hinterlegt`, `(${maskSecret(env.SFTP_PASSWORD)})`);
  }

  const root = env.SFTP_REMOTE_ROOT ?? '';
  const segments = root.split('/').filter(Boolean);
  if (segments.length === 0) {
    problem(
      `SFTP_REMOTE_ROOT ist "${root}" und zeigt damit auf das Wurzelverzeichnis des Webspace.`,
      'Das Deployment verweigert das, weil dabei fremde Dateien gelöscht werden könnten. ' +
        'Trage ein echtes Unterverzeichnis ein, z. B. /v3/.',
    );
  } else {
    pass(`Zielverzeichnis auf dem Server: /${segments.join('/')}/`);
  }

  // Die Datei enthält ein Passwort im Klartext.
  try {
    const mode = fs.statSync(home.sftpEnv).mode & 0o777;
    if (process.platform !== 'win32' && (mode & 0o077) !== 0) {
      hint(
        `sftp.env ist für andere Benutzer lesbar (Rechte ${mode.toString(8)}).`,
        'Empfohlen:  chmod 600 sftp.env',
      );
    } else {
      pass('sftp.env ist nur für dich lesbar');
    }
  } catch {
    /* Rechteprüfung ist nur ein Hinweis */
  }
}

function checkGit(home) {
  heading('Git und Sicherung');
  if (!run('git', ['--version'])) {
    problem('Git ist nicht installiert.', 'Von https://git-scm.com installieren.');
    return;
  }

  // Ausdrücklich im Inhaltsordner: das Werkzeug unter werkzeug/ ist ein
  // eigenes Repository. Ohne diese Unterscheidung prüfte alles Folgende
  // die falsche Versionsgeschichte.
  const inHome = (args) => run('git', args, { cwd: home.root });

  const top = repositoryRoot(home.root);
  if (!top) {
    problem(
      'Der Inhaltsordner ist kein Git-Repository.',
      `Ohne Git gibt es keine Sicherung, und umbenannte oder gelöschte Flyer\n` +
        `    fallen niemandem auf. Im Inhaltsordner ausführen:  git init`,
    );
    return;
  }
  if (top !== fs.realpathSync(home.root)) {
    problem(
      'Der Inhaltsordner ist nur ein Unterordner eines anderen Repositories.',
      `Gefunden: ${top}\n    Erwartet: ${home.root}\n` +
        '    Inhalte und Werkzeug müssen getrennte Repositories sein.',
    );
    return;
  }
  pass('Inhaltsordner ist ein eigenes Git-Repository');

  const remotes = inHome(['remote']);
  if (!remotes) {
    hint(
      'Es ist kein Git-Remote eingerichtet — es gibt damit keine Sicherung der Inhalte.',
      'Ein privates Repository anlegen und verbinden:  git remote add origin <adresse>',
    );
  } else {
    const url = inHome(['remote', 'get-url', remotes.split('\n')[0]]);
    pass(`Sicherung: ${remotes.split('\n')[0]}`, url ? `→ ${url}` : '');
  }

  if (!inHome(['lfs', 'version'])) {
    problem(
      'Git LFS ist nicht installiert.',
      'Die Druck-PDFs werden über Git LFS verwaltet. Ohne LFS wird das Repository sehr gross. ' +
        'Installation: https://git-lfs.com — danach einmalig:  git lfs install',
    );
  } else if (!inHome(['config', '--get', 'filter.lfs.clean'])) {
    problem('Git LFS ist installiert, aber nicht aktiviert.', 'Einmalig ausführen:  git lfs install');
  } else {
    const attributesFile = path.join(home.root, '.gitattributes');
    const attributes = fs.existsSync(attributesFile) ? fs.readFileSync(attributesFile, 'utf8') : '';
    if (/^\*\.pdf\s+filter=lfs/m.test(attributes)) {
      pass('Git LFS ist aktiv und verwaltet die PDF-Dateien');
    } else {
      hint('Git LFS ist aktiv, aber .gitattributes verwaltet keine PDFs.');
    }
  }

  // Der wichtigste Test dieses Abschnitts: Bestelldaten enthalten Namen und
  // Postadressen und dürfen unter keinen Umständen ins Repository gelangen.
  const probe = path.join('app-data', 'orders', 'probe.json');
  const ignored = succeeds('git', ['check-ignore', '-q', probe], home.root);
  if (ignored) {
    pass('app-data/ wird von Git ignoriert', '— Bestelldaten bleiben aus dem Repository heraus');
  } else {
    problem(
      'app-data/ wird NICHT von Git ignoriert.',
      'Dort liegen Namen und Postadressen. Trage "app-data/" in .gitignore ein, bevor du etwas committest.',
    );
  }
}

function checkWorkspace(home, config) {
  heading('Inhaltsordner');
  info(color.gray(`    ${home.root}`));
  try {
    fs.mkdirSync(home.generated, { recursive: true });
    const probe = path.join(home.generated, '.schreibtest');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    pass('Schreibrechte vorhanden');
  } catch {
    problem('In den Inhaltsordner kann nicht geschrieben werden.', `Rechte für ${home.root} prüfen.`);
  }

  const flyerCount = fs.existsSync(home.flyers)
    ? fs.readdirSync(home.flyers, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    : 0;
  if (flyerCount === 0) {
    hint(
      'Es ist noch kein Flyer vorhanden.',
      'Beispielinhalte anlegen:  npm run demo    — oder einen echten Flyer:  npm run new',
    );
  } else {
    pass(plural(flyerCount, 'Flyer im Inhaltsordner', 'Flyer im Inhaltsordner'));
  }

  if (fs.existsSync(home.cache)) {
    let bytes = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else bytes += fs.statSync(full).size;
      }
    };
    walk(home.cache);
    info(color.gray(`    Zwischenspeicher: ${formatBytes(bytes)} (löschen mit npm run clean)`));
  }

  // Sobald die Website unter der echten Domain läuft, darf die Sperre für
  // Suchmaschinen nicht mehr in der erzeugten .htaccess stehen.
  const htaccess = path.join(home.dist, '.htaccess');
  if (config && config.isCanonical && fs.existsSync(htaccess)) {
    if (fs.readFileSync(htaccess, 'utf8').includes('noindex')) {
      problem(
        'Die erzeugte .htaccess sperrt noch Suchmaschinen aus, obwohl die echte Domain aktiv ist.',
        'Einmal neu bauen:  npm run build',
      );
    } else {
      pass('Keine Suchmaschinen-Sperre mehr aktiv');
    }
  }
}

/**
 * Der Stand des Werkzeugs.
 *
 * Ein Submodul läuft lautlos auseinander: "git clone" ohne
 * --recurse-submodules lässt den Ordner leer, "git pull" holt den neuen
 * Stand der Inhalte, aber nicht den des Werkzeugs. Beides sieht man dem
 * Ordner nicht an — deshalb wird es hier benannt.
 */
function checkWerkzeug(home) {
  heading('Werkzeug');
  info(color.gray(`    ${SYS.root}`));

  // Beim Arbeiten am Werkzeug selbst liegt es neben dem Inhaltsordner statt
  // darin. Das ist kein Mangel, sondern der Entwicklungsfall — und soll
  // nicht als Warnung erscheinen.
  if (!SYS.root.startsWith(home.root + path.sep)) {
    info(color.gray('    Das Werkzeug liegt nicht im Inhaltsordner — Entwicklungsaufbau.'));
    info(color.gray('    Im Normalfall liegt es als Submodul unter werkzeug/.'));
    return;
  }

  const status = parseSubmoduleStatus(
    run('git', ['submodule', 'status', '--', WERKZEUG_DIR], { cwd: home.root, raw: true }),
  );
  const described = describeSubmoduleState(status, { dir: WERKZEUG_DIR });

  if (described.level === 'ok') pass(described.message);
  else if (described.level === 'problem') problem(described.message, described.hint && `    ${described.hint}`);
  else hint(described.message, described.hint && `    ${described.hint}`);

  if (status.state === 'missing') return;

  if (!fs.existsSync(path.join(SYS.root, 'node_modules'))) {
    problem(
      'Im Werkzeug fehlen die Programmbibliotheken.',
      `    Einmalig ausführen:  cd ${WERKZEUG_DIR} && npm ci && cd ..`,
    );
  }
}

function checkOptional() {
  heading('Optional');
  const php = run('php', ['-r', 'echo PHP_VERSION;']);
  if (php) {
    pass(`PHP ${php} vorhanden`, '— npm run preview testet damit auch die Formulare');
  } else {
    info(
      color.gray(
        '    PHP ist nicht installiert. Die Vorschau funktioniert trotzdem, ' +
          'nur Bestell- und Kontaktformular lassen sich lokal nicht testen.',
      ),
    );
  }
}

runMain(async () => {
  heading('Biblia — Systemprüfung');

  // Absichtlich nachsichtig: doctor ist der Befehl, den man gerade dann
  // ausführt, wenn noch nichts eingerichtet ist. Er soll dann erklären,
  // was fehlt, statt selbst abzubrechen.
  const home = findHome();

  checkNode();
  checkDependencies();

  if (!home) {
    heading('Inhaltsordner');
    problem(
      'Es wurde kein Inhaltsordner gefunden.',
      '    Die Befehle werden im Inhaltsordner ausgeführt — dort liegen Flyer,\n' +
        '    Einstellungen und Zugangsdaten.\n\n' +
        '    Einen vorhandenen holen:   git clone --recurse-submodules <adresse>\n' +
        `    Einen neuen anlegen:       node ${path.join(SYS.scripts, 'init.mjs')} <pfad>`,
    );
    checkOptional();
  } else {
    const config = await checkConfig(home);
    checkDeployConfig(home);
    checkGit(home);
    checkWerkzeug(home);
    checkWorkspace(home, config);
    checkOptional();
  }

  heading('Ergebnis');
  if (results.error === 0 && results.warn === 0) {
    ok('Alles in Ordnung.');
  } else {
    if (results.error > 0) error(plural(results.error, 'Problem muss behoben werden', 'Probleme müssen behoben werden'));
    if (results.warn > 0) warn(plural(results.warn, 'Hinweis', 'Hinweise'));
  }
  blank();
  return results.error > 0 ? 1 : 0;
});
