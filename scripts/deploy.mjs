/**
 * npm run deploy
 *
 * Lädt den Inhalt von dist/ auf den Server.
 *
 *   --dry-run        Nur anzeigen, was geschehen würde
 *   --adopt          Ein bereits gefülltes Zielverzeichnis übernehmen
 *   --no-delete      Nichts löschen
 *   --remote-root X  Anderes Zielverzeichnis (zum Ausprobieren)
 *   --connections N  Anzahl paralleler Verbindungen (Standard 4)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { DIR } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { listFilesRecursive, isProtectedPath } from './lib/emit.mjs';
import {
  loadDeployConfig, projectFingerprint, connect, connectPool, closeAll, runPooled,
  ensureDirectory, resetDirectoryCache, mayDelete, SENTINEL_FILE, MANIFEST_FILE,
} from './lib/sftp.mjs';
import {
  blank, color, error, formatBytes, formatDuration, heading, info, ok, plural, runMain, step, warn, fail,
} from './lib/log.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const dryRun = flag('--dry-run');
const adopt = flag('--adopt');
const noDelete = flag('--no-delete');
const connections = Math.max(1, Math.min(8, Number(option('--connections') ?? 4)));

/** Hash einer lokalen Datei. */
function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 32);
}

/** Beschreibung aller hochzuladenden Dateien. */
function localManifest() {
  const manifest = {};
  for (const relative of listFilesRecursive(DIR.dist)) {
    // Laufzeitdaten gehören dem Server, nicht dem Build. Lokal entstehen
    // sie nur beim Ausprobieren der Vorschau.
    if (isProtectedPath(relative) && !relative.endsWith('.htaccess') && !relative.endsWith('index.html')) {
      continue;
    }
    manifest[relative] = hashFile(path.join(DIR.dist, relative));
  }
  return manifest;
}

/**
 * Reihenfolge beim Hochladen: zuerst alles, worauf Seiten verweisen,
 * danach die Seiten selbst. Dadurch zeigt die Website während des
 * Hochladens nie auf eine Datei, die es noch nicht gibt.
 */
function uploadOrder(paths) {
  const weight = (file) => {
    if (file.endsWith('.html')) return 3;
    if (file === MANIFEST_FILE || file === SENTINEL_FILE) return 4;
    if (file.endsWith('.htaccess')) return 2;
    return 1;
  };
  return [...paths].sort((a, b) => weight(a) - weight(b) || a.localeCompare(b));
}

async function readRemoteJson(client, remotePath) {
  try {
    const buffer = await client.get(remotePath);
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

runMain(async () => {
  const config = loadConfig();
  const deploy = loadDeployConfig({ remoteRootOverride: option('--remote-root') });
  const fingerprint = projectFingerprint(config);

  heading('Biblia — Website hochladen');
  info(color.gray(`    Ziel:    ${deploy.username}@${deploy.host}:${deploy.remoteRoot}`));
  info(color.gray(`    Adresse: ${config.baseUrl}`));
  if (dryRun) warn('Probelauf — es wird nichts verändert.');
  blank();

  if (!fs.existsSync(DIR.dist) || listFilesRecursive(DIR.dist).length === 0) {
    fail('Der Ordner dist/ ist leer.', 'Zuerst die Website erzeugen:  npm run build');
  }

  const local = localManifest();
  const localPaths = Object.keys(local);

  step('Verbinden');
  const control = await connect(deploy);

  try {
    await ensureDirectory(control, deploy.remoteRoot);

    // --- Kennung prüfen ---
    const sentinelPath = `${deploy.remoteRoot}/${SENTINEL_FILE}`;
    const sentinel = await readRemoteJson(control, sentinelPath);
    const previous = (await readRemoteJson(control, `${deploy.remoteRoot}/${MANIFEST_FILE}`)) ?? {};

    let mayRemove = !noDelete;

    if (sentinel === null) {
      const existing = await control.list(deploy.remoteRoot).catch(() => []);
      const foreign = existing.filter((item) => !item.name.startsWith('.'));
      if (foreign.length > 0 && !adopt) {
        fail(
          `Das Zielverzeichnis ${deploy.remoteRoot} enthält bereits ${plural(foreign.length, 'Eintrag', 'Einträge')}, gehört aber zu keinem bekannten Biblia-Projekt.`,
          'Zum Schutz fremder Dateien wird nichts gelöscht und nichts überschrieben.\n' +
            '  Wenn das Verzeichnis wirklich zu dieser Website gehört, einmalig ausführen:\n' +
            '      npm run deploy -- --adopt',
        );
      }
      // Beim ersten Hochladen ist noch nicht bekannt, was der Build früher
      // abgelegt hat. Deshalb wird diesmal nichts entfernt.
      mayRemove = false;
      if (dryRun) {
        ok('Zielverzeichnis würde für dieses Projekt gekennzeichnet.');
      } else {
        await control.put(
          Buffer.from(
            `${JSON.stringify({ project: 'biblia', site: config.siteName, basePath: config.basePath, fingerprint }, null, 2)}\n`,
          ),
          sentinelPath,
        );
        ok('Zielverzeichnis für dieses Projekt gekennzeichnet.');
      }
    } else if (sentinel.fingerprint !== fingerprint) {
      fail(
        `Das Zielverzeichnis ${deploy.remoteRoot} gehört zu einer anderen Website.`,
        `Dort ist "${sentinel.site ?? 'unbekannt'}" unter "${sentinel.basePath ?? '?'}" eingetragen.\n` +
          '  Es wird nichts verändert. Prüfe SFTP_REMOTE_ROOT in sftp.env und baseUrl in config/site.json.',
      );
    }

    // --- Vergleichen ---
    const changed = localPaths.filter((file) => previous[file] !== local[file]);
    const unchanged = localPaths.length - changed.length;
    const removable = mayRemove
      ? Object.keys(previous).filter((file) => !Object.hasOwn(local, file) && mayDelete(file, previous))
      : [];

    let bytes = 0;
    for (const file of changed) bytes += fs.statSync(path.join(DIR.dist, file)).size;

    blank();
    ok(`${plural(localPaths.length, 'Datei', 'Dateien')} in dist/`);
    info(color.gray(`    ${changed.length} neu oder geändert (${formatBytes(bytes)}), ${unchanged} unverändert`));
    if (removable.length > 0) info(color.gray(`    ${plural(removable.length, 'Datei wird entfernt', 'Dateien werden entfernt')}`));
    if (!mayRemove && Object.keys(previous).length > 0) {
      info(color.gray('    Es wird nichts entfernt.'));
    }

    if (dryRun) {
      blank();
      for (const file of changed.slice(0, 30)) info(color.gray(`    + ${file}`));
      if (changed.length > 30) info(color.gray(`    … und ${changed.length - 30} weitere`));
      for (const file of removable.slice(0, 20)) info(color.gray(`    - ${file}`));
      blank();
      ok('Probelauf beendet. Es wurde nichts verändert.');
      blank();
      return 0;
    }

    if (changed.length === 0 && removable.length === 0) {
      blank();
      ok('Auf dem Server ist bereits alles aktuell.');
      blank();
      return 0;
    }

    // --- Hochladen ---
    step(`Hochladen über ${plural(connections, 'Verbindung', 'Verbindungen')}`);
    const started = Date.now();
    resetDirectoryCache();

    // Verzeichnisse zuerst, der Reihe nach — sonst legen mehrere
    // Verbindungen dasselbe Verzeichnis gleichzeitig an.
    const directories = [
      ...new Set(changed.map((file) => path.posix.dirname(file)).filter((dir) => dir !== '.')),
    ].sort();
    for (const directory of directories) {
      await ensureDirectory(control, `${deploy.remoteRoot}/${directory}`);
    }

    const pool = await connectPool(deploy, Math.max(1, connections - 1));
    const clients = [control, ...pool];
    let done = 0;
    let failed = [];

    await runPooled(clients, uploadOrder(changed), async (client, file) => {
      const target = `${deploy.remoteRoot}/${file}`;
      try {
        await client.put(path.join(DIR.dist, file), target);
        // PHP und .htaccess müssen für den Webserver lesbar sein.
        await client.chmod(target, 0o644).catch(() => {});
      } catch (err) {
        failed.push({ file, message: err.message });
      }
      done += 1;
      if (done % 25 === 0 || done === changed.length) {
        process.stdout.write(`\r  ${done}/${changed.length} Dateien   `);
      }
    });
    process.stdout.write('\n');
    await closeAll(pool);

    if (failed.length > 0) {
      blank();
      error(plural(failed.length, 'Datei konnte nicht hochgeladen werden', 'Dateien konnten nicht hochgeladen werden'));
      for (const item of failed.slice(0, 10)) info(color.gray(`    ${item.file}: ${item.message}`));
      info('Der Vorgang lässt sich gefahrlos wiederholen:  npm run deploy');
      blank();
      return 1;
    }

    // --- Entfernen, zuletzt und in den Papierkorb ---
    if (removable.length > 0) {
      step('Nicht mehr benötigte Dateien');
      const trash = `${deploy.remoteRoot}/.papierkorb-${new Date().toISOString().slice(0, 10)}`;
      await ensureDirectory(control, trash);
      for (const file of removable) {
        const from = `${deploy.remoteRoot}/${file}`;
        const to = `${trash}/${file.replace(/\//g, '__')}`;
        try {
          await control.rename(from, to);
        } catch {
          await control.delete(from, true).catch(() => {});
        }
      }
      ok(`${plural(removable.length, 'Datei', 'Dateien')} in ${path.posix.basename(trash)} verschoben`);
      info(color.gray('    Der Papierkorb kann nach einer Prüfung von Hand gelöscht werden.'));
    }

    // --- Neue Beschreibung ablegen, ganz zum Schluss ---
    await control.put(Buffer.from(`${JSON.stringify(local)}\n`), `${deploy.remoteRoot}/${MANIFEST_FILE}`);

    blank();
    ok(`Hochgeladen in ${formatDuration(Date.now() - started)}.`);

    // --- Nachprüfen ---
    step('Website prüfen');
    const checks = await verify(config);
    for (const check of checks) {
      if (check.ok) ok(`${check.label} ${color.gray(check.detail)}`);
      else error(`${check.label} — ${check.detail}`);
    }

    const problems = checks.filter((check) => !check.ok);
    blank();
    if (problems.length === 0) {
      ok('Fertig.');
      info(`    ${config.baseUrl}`);
    } else {
      error(plural(problems.length, 'Prüfung fehlgeschlagen', 'Prüfungen fehlgeschlagen'));
    }
    blank();
    return problems.length > 0 ? 1 : 0;
  } finally {
    await control.end().catch(() => {});
  }
});

/**
 * Prüfungen über HTTP, nachdem alles oben ist.
 *
 * Die wichtigste ist die letzte: die Laufzeitdaten dürfen nicht abrufbar
 * sein. Sie liegen innerhalb des Webverzeichnisses und sind nur durch eine
 * .htaccess geschützt — das muss nach jedem Hochladen bestätigt werden.
 */
async function verify(config) {
  const checks = [];
  const get = async (url, options = {}) => {
    try {
      const response = await fetch(url, { redirect: 'manual', ...options });
      return { status: response.status, type: response.headers.get('content-type') ?? '' };
    } catch (err) {
      return { status: 0, error: err.message };
    }
  };

  const home = await get(`${config.baseUrl}${config.defaultLanguage}/`);
  checks.push({
    ok: home.status === 200,
    label: 'Startseite erreichbar',
    detail: home.status === 200 ? `(HTTP 200)` : `HTTP ${home.status} ${home.error ?? ''}`,
  });

  const missing = await get(`${config.baseUrl}gibt-es-nicht-${Date.now()}/`);
  checks.push({
    ok: missing.status === 404,
    label: 'Unbekannte Adressen liefern 404',
    detail: `(HTTP ${missing.status})`,
  });

  const data = await get(`${config.baseUrl}app-data/`);
  const dataOk = data.status === 403 || data.status === 404;
  checks.push({
    ok: dataOk,
    label: 'Laufzeitdaten sind gesperrt',
    detail: dataOk
      ? `(HTTP ${data.status})`
      : `HTTP ${data.status} — Bestell- und Kontaktdaten wären öffentlich abrufbar. Prüfe, ob .htaccess auf dem Server erlaubt ist.`,
  });

  return checks;
}
