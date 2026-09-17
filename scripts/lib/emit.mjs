/**
 * Sammelt alle Dateien der fertigen Website und schreibt sie nach dist/.
 *
 * Erst sammeln, dann schreiben: dadurch lässt sich am Ende genau sagen,
 * welche Dateien nicht mehr dazugehören, und diese werden entfernt.
 * Unveränderte Dateien werden nicht neu geschrieben — das hält sowohl den
 * Build als auch das anschliessende Hochladen kurz.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Kurzer Hash für Dateinamen mit Versionsstempel. */
export function shortHash(data) {
  return sha256(data).slice(0, 10);
}

/**
 * Pfade, die zur Website gehören, aber nicht vom Build erzeugt werden.
 *
 * Unter app-data/ legt PHP zur Laufzeit Bestellungen und Kontaktanfragen
 * ab. Diese Dateien dürfen weder beim Bauen noch beim Hochladen entfernt
 * werden — sie sind durch nichts wiederherstellbar.
 */
export const PROTECTED_PREFIXES = ['app-data/'];

/** Gehört dieser Pfad zu den geschützten Laufzeitdaten? */
export function isProtectedPath(target) {
  return PROTECTED_PREFIXES.some((prefix) => target === prefix.slice(0, -1) || target.startsWith(prefix));
}

export class Emitter {
  /** @param {string} outDir Zielverzeichnis, üblicherweise dist/ */
  constructor(outDir) {
    this.outDir = outDir;
    /** @type {Map<string, {kind:'data'|'copy', data?:Buffer, from?:string}>} */
    this.files = new Map();
  }

  /** Normalisiert einen Ausgabepfad zu einem relativen Pfad ohne führenden Schrägstrich. */
  static normalize(target) {
    const clean = target.replace(/^\/+/, '');
    if (clean === '' || clean.includes('..')) {
      throw new Error(`Ungültiger Ausgabepfad: ${target}`);
    }
    return clean;
  }

  /** Legt eine Datei mit Inhalt an. */
  add(target, contents) {
    const key = Emitter.normalize(target);
    if (this.files.has(key)) {
      throw new Error(`Zwei Seiten wollen dieselbe Datei schreiben: ${key}`);
    }
    this.files.set(key, {
      kind: 'data',
      data: Buffer.isBuffer(contents) ? contents : Buffer.from(String(contents), 'utf8'),
    });
    return key;
  }

  /**
   * Legt eine Seite als <verzeichnis>/index.html an.
   * "/" ist der Wurzeleintrag und wird zu index.html.
   */
  addPage(urlPath, htmlText) {
    const clean = String(urlPath).replace(/^\/+/, '');
    if (clean.includes('..')) {
      throw new Error(`Ungültiger Seitenpfad: ${urlPath}`);
    }
    const target = clean === '' || clean.endsWith('/') ? `${clean}index.html` : `${clean}/index.html`;
    return this.add(target, htmlText);
  }

  /** Übernimmt eine vorhandene Datei, ohne sie in den Speicher zu laden. */
  copy(target, sourceFile) {
    const key = Emitter.normalize(target);
    if (this.files.has(key)) {
      throw new Error(`Zwei Quellen wollen dieselbe Datei schreiben: ${key}`);
    }
    this.files.set(key, { kind: 'copy', from: sourceFile });
    return key;
  }

  get size() {
    return this.files.size;
  }

  /** Alle Ausgabepfade, alphabetisch. */
  paths() {
    return [...this.files.keys()].sort();
  }

  /**
   * Schreibt alles nach dist/ und entfernt, was nicht mehr dazugehört.
   * @returns {{written:number, unchanged:number, removed:string[], bytes:number}}
   */
  write() {
    fs.mkdirSync(this.outDir, { recursive: true });

    const existing = new Set(listFilesRecursive(this.outDir));
    let written = 0;
    let unchanged = 0;
    let bytes = 0;

    for (const key of this.paths()) {
      const entry = this.files.get(key);
      const target = path.join(this.outDir, key);
      const data = entry.kind === 'data' ? entry.data : fs.readFileSync(entry.from);
      bytes += data.length;

      existing.delete(key);

      if (fs.existsSync(target)) {
        const current = fs.readFileSync(target);
        if (current.equals(data)) {
          unchanged += 1;
          continue;
        }
      }

      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Erst in eine Nebendatei schreiben, dann umbenennen: ein Abbruch
      // hinterlässt so keine halbe Datei, die beim nächsten Lauf als
      // gültig gelten würde.
      const temporary = `${target}.tmp-${process.pid}`;
      fs.writeFileSync(temporary, data);
      fs.renameSync(temporary, target);
      written += 1;
    }

    // Was der Build nicht kennt, wird entfernt — mit Ausnahme der
    // Laufzeitdaten, die PHP auf dem Server selbst anlegt.
    const removed = [...existing].filter((key) => !isProtectedPath(key)).sort();
    for (const key of removed) {
      try {
        fs.unlinkSync(path.join(this.outDir, key));
      } catch {
        /* bereits weg */
      }
    }
    removeEmptyDirectories(this.outDir);

    return { written, unchanged, removed, bytes };
  }
}

/** Alle Dateien unterhalb eines Verzeichnisses, relativ und mit Schrägstrichen. */
export function listFilesRecursive(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFilesRecursive(path.join(dir, entry.name), relative));
    else out.push(relative);
  }
  return out;
}

function removeEmptyDirectories(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    removeEmptyDirectories(full);
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
}
