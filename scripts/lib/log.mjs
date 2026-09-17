/**
 * Ausgabe auf der Kommandozeile.
 *
 * Zielgruppe sind die Mitarbeiter von Biblia, nicht Entwickler.
 * Deshalb: deutsche Meldungen, keine Stacktraces, immer ein Hinweis,
 * was als Nächstes zu tun ist.
 */

const ESC = String.fromCharCode(27);

const useColor = Boolean(
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb',
);

const wrap = (code) => (text) => (useColor ? `${ESC}[${code}m${text}${ESC}[0m` : String(text));

export const color = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  gray: wrap('90'),
};

const out = (line = '') => process.stdout.write(`${line}\n`);

export const blank = () => out();

export function heading(text) {
  out();
  out(color.bold(text));
  out(color.gray('─'.repeat(Math.max(text.length, 8))));
}

export const step = (text) => out(`${color.blue('›')} ${text}`);
export const ok = (text) => out(`${color.green('✓')} ${text}`);
export const warn = (text) => out(`${color.yellow('⚠')} ${text}`);
export const error = (text) => out(`${color.red('✗')} ${text}`);
export const info = (text) => out(`  ${text}`);
export const detail = (text) => out(color.gray(`    ${text}`));

/** Menschenlesbare Dauer. */
export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} min ${seconds} s`;
}

/** Menschenlesbare Dateigrösse. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Zahlwort mit deutschem Plural. */
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Fehler mit verständlicher Meldung und optionalem Lösungshinweis.
 * Wird von runMain() ohne Stacktrace ausgegeben.
 */
export class FriendlyError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'FriendlyError';
    this.hint = hint;
  }
}

export const fail = (message, hint) => {
  throw new FriendlyError(message, hint);
};

/**
 * Einstiegspunkt für jedes Skript.
 * Fängt Fehler ab, gibt sie verständlich aus und setzt den Exit-Code.
 */
export async function runMain(fn) {
  try {
    const code = await fn();
    if (typeof code === 'number' && code !== 0) process.exitCode = code;
  } catch (err) {
    blank();
    if (err instanceof FriendlyError) {
      error(err.message);
      if (err.hint) {
        blank();
        info(err.hint);
      }
    } else {
      error('Unerwarteter Fehler.');
      info(err?.message ?? String(err));
      if (process.env.BIBLIA_DEBUG) {
        blank();
        out(color.gray(err?.stack ?? ''));
      } else {
        blank();
        info(color.gray('Für technische Details: BIBLIA_DEBUG=1 vor den Befehl setzen.'));
      }
    }
    blank();
    process.exitCode = 1;
  }
}
