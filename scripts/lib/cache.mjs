/**
 * Zwischenspeicher für erzeugte Medien.
 *
 * Das Rendern der PDF-Seiten ist mit Abstand der teuerste Schritt im Build.
 * Bei hunderten Flyern wäre ein vollständiger Durchlauf bei jeder kleinen
 * Textänderung nicht zumutbar.
 *
 * Der Schlüssel muss ALLES enthalten, woraus das Ergebnis entsteht. Ein
 * Schlüssel nur aus dem PDF wäre falsch: das Teilen-Bild enthält auch Titel,
 * Aufforderungstext, Adresse und QR-Code. Ändert sich der Titel, muss das
 * Bild neu erzeugt werden, obwohl das PDF gleich geblieben ist.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Version der Pipeline. Erhöhen, wenn sich die Erzeugung ändert. */
export const PIPELINE_VERSION = 1;

/** Stabiler Hash über beliebige Daten — Schlüssel werden sortiert. */
export function hashKey(parts) {
  const hash = crypto.createHash('sha256');
  hash.update(String(PIPELINE_VERSION));
  hash.update(JSON.stringify(parts, Object.keys(parts).sort()));
  return hash.digest('hex').slice(0, 24);
}

/** Hash einer Datei — wird für den Schlüssel der Quelldatei gebraucht. */
export function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 24);
}

export class Cache {
  /**
   * @param {string} dir       Verzeichnis des Zwischenspeichers
   * @param {boolean} disabled Alles neu erzeugen (--force)
   */
  constructor(dir, { disabled = false } = {}) {
    this.dir = dir;
    this.disabled = disabled;
    this.used = new Set();
    this.hits = 0;
    this.misses = 0;
    fs.mkdirSync(dir, { recursive: true });
  }

  entryDir(key) {
    // Zweistufig, damit nicht zehntausende Verzeichnisse nebeneinander liegen.
    return path.join(this.dir, key.slice(0, 2), key);
  }

  /**
   * Liefert das zwischengespeicherte Ergebnis oder erzeugt es.
   *
   * @param {object} keyParts  Alles, woraus das Ergebnis entsteht
   * @param {(workDir:string)=>Promise<object>} produce
   *        Erzeugt die Dateien in workDir und liefert die Beschreibung zurück
   * @returns {Promise<{meta:object, dir:string, cached:boolean}>}
   */
  async use(keyParts, produce) {
    const key = hashKey(keyParts);
    const dir = this.entryDir(key);
    this.used.add(key);

    const metaFile = path.join(dir, 'meta.json');
    if (!this.disabled && fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        // Nur gültig, wenn auch alle beschriebenen Dateien vorhanden sind.
        // Ein Abbruch mitten im Schreiben soll nicht als Treffer gelten.
        const complete = (meta.files ?? []).every((name) => fs.existsSync(path.join(dir, name)));
        if (complete) {
          this.hits += 1;
          return { meta: meta.data, dir, cached: true };
        }
      } catch {
        /* beschädigter Eintrag — neu erzeugen */
      }
    }

    this.misses += 1;

    // In ein Nebenverzeichnis erzeugen und erst am Ende umbenennen. Damit
    // gibt es niemals einen halb gefüllten Eintrag, der als gültig gilt.
    const temporary = `${dir}.tmp-${process.pid}-${this.misses}`;
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.mkdirSync(temporary, { recursive: true });

    let data;
    try {
      data = await produce(temporary);
    } catch (err) {
      fs.rmSync(temporary, { recursive: true, force: true });
      throw err;
    }

    const files = fs
      .readdirSync(temporary)
      .filter((name) => name !== 'meta.json')
      .sort();
    fs.writeFileSync(path.join(temporary, 'meta.json'), JSON.stringify({ data, files }, null, 0));

    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(temporary, dir);

    return { meta: data, dir, cached: false };
  }

  /**
   * Entfernt Einträge, die in diesem Lauf nicht gebraucht wurden.
   * Ohne das wächst der Zwischenspeicher mit jeder Änderung weiter.
   */
  collectGarbage() {
    let removed = 0;
    if (!fs.existsSync(this.dir)) return removed;

    for (const bucket of fs.readdirSync(this.dir)) {
      const bucketDir = path.join(this.dir, bucket);
      if (!fs.statSync(bucketDir).isDirectory()) continue;
      for (const key of fs.readdirSync(bucketDir)) {
        if (this.used.has(key)) continue;
        fs.rmSync(path.join(bucketDir, key), { recursive: true, force: true });
        removed += 1;
      }
      if (fs.readdirSync(bucketDir).length === 0) fs.rmdirSync(bucketDir);
    }
    return removed;
  }
}
