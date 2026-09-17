/**
 * SFTP-Verbindung und Schutzmassnahmen beim Hochladen.
 *
 * Das Löschen von Dateien auf dem Server ist der einzige Vorgang im ganzen
 * Projekt, der sich nicht rückgängig machen lässt. Deshalb ist er hier
 * mehrfach abgesichert:
 *
 *   1. Das Zielverzeichnis darf nie das Wurzelverzeichnis sein.
 *   2. Eine Kennungsdatei muss bestätigen, dass dieses Verzeichnis zu
 *      diesem Projekt gehört.
 *   3. Gelöscht wird ausschliesslich, was ein früherer Build selbst
 *      hochgeladen hat — fremde Dateien werden nie angefasst.
 *   4. Laufzeitdaten sind grundsätzlich ausgenommen.
 *   5. Gelöschtes wandert zuerst in einen Papierkorb auf dem Server.
 */
import crypto from 'node:crypto';
import SftpClient from 'ssh2-sftp-client';
import { readEnvFile } from './env.mjs';
import { FILE } from './paths.mjs';
import { fail } from './log.mjs';
import { isProtectedPath } from './emit.mjs';

export const SENTINEL_FILE = '.biblia-site';
export const MANIFEST_FILE = '.biblia-manifest.json';

/** Liest und prüft die Zugangsdaten. */
export function loadDeployConfig({ remoteRootOverride = null } = {}) {
  const env = readEnvFile(FILE.sftpEnv);

  const missing = ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_REMOTE_ROOT'].filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    fail(
      `In sftp.env fehlen: ${missing.join(', ')}`,
      'Kopiere sftp.env.example zu sftp.env und trage die Zugangsdaten ein.',
    );
  }

  const rawRoot = remoteRootOverride ?? env.SFTP_REMOTE_ROOT;
  const segments = String(rawRoot).split('/').filter((part) => part !== '' && part !== '.');

  // Die wichtigste Sicherung: niemals im Wurzelverzeichnis arbeiten.
  if (segments.length === 0) {
    fail(
      `Das Zielverzeichnis auf dem Server ist "${rawRoot}" und damit das Wurzelverzeichnis.`,
      'Das Hochladen wird abgelehnt, weil dabei fremde Dateien gelöscht werden könnten. ' +
        'Trage in sftp.env ein echtes Unterverzeichnis ein, zum Beispiel /v3/.',
    );
  }
  if (segments.includes('..')) {
    fail(`Das Zielverzeichnis enthält "..": ${rawRoot}`);
  }

  return {
    host: env.SFTP_HOST,
    port: Number(env.SFTP_PORT || 22),
    username: env.SFTP_USER,
    password: env.SFTP_PASSWORD,
    remoteRoot: `/${segments.join('/')}`,
  };
}

/**
 * Kennung dieses Projekts und Zielverzeichnisses.
 * Sie entsteht aus festen Werten, muss also nirgends gespeichert werden.
 */
export function projectFingerprint(config) {
  return crypto
    .createHash('sha256')
    .update(`biblia|${config.siteName}|${config.basePath}`)
    .digest('hex')
    .slice(0, 32);
}

/** Baut eine SFTP-Verbindung auf. */
export async function connect(deployConfig) {
  const client = new SftpClient();
  try {
    await client.connect({
      host: deployConfig.host,
      port: deployConfig.port,
      username: deployConfig.username,
      password: deployConfig.password,
      readyTimeout: 20000,
      retries: 2,
    });
  } catch (err) {
    fail(
      `Die Verbindung zu ${deployConfig.host} ist fehlgeschlagen.`,
      `${err.message}\nPrüfe Adresse, Benutzername und Passwort in sftp.env sowie die Internetverbindung.`,
    );
  }
  return client;
}

/** Mehrere Verbindungen für paralleles Hochladen. */
export async function connectPool(deployConfig, size) {
  const clients = [];
  for (let i = 0; i < size; i += 1) {
    clients.push(await connect(deployConfig));
  }
  return clients;
}

export async function closeAll(clients) {
  await Promise.allSettled(clients.map((client) => client.end()));
}

/** Verteilt Arbeit auf die Verbindungen. */
export async function runPooled(clients, items, worker) {
  const queue = [...items];
  let index = 0;
  await Promise.all(
    clients.map(async (client) => {
      for (;;) {
        const position = index;
        index += 1;
        if (position >= queue.length) return;
        await worker(client, queue[position], position);
      }
    }),
  );
}

/** Legt ein Verzeichnis samt Elternverzeichnissen an. */
const createdDirectories = new Set();
export async function ensureDirectory(client, remotePath) {
  if (createdDirectories.has(remotePath) || remotePath === '/' || remotePath === '') return;
  try {
    await client.mkdir(remotePath, true);
  } catch {
    /* existiert bereits */
  }
  createdDirectories.add(remotePath);
}

export function resetDirectoryCache() {
  createdDirectories.clear();
}

/**
 * Entscheidet, ob eine Datei gelöscht werden darf.
 * Nur Dateien, die ein früherer Build selbst hochgeladen hat.
 */
export function mayDelete(remoteRelativePath, previousManifest) {
  if (isProtectedPath(remoteRelativePath)) return false;
  if (remoteRelativePath === SENTINEL_FILE || remoteRelativePath === MANIFEST_FILE) return false;
  if (remoteRelativePath.startsWith('.papierkorb-')) return false;
  return Object.hasOwn(previousManifest, remoteRelativePath);
}
