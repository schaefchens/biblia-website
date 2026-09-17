/**
 * Minimale, sichere HTML-Erzeugung ohne Template-Engine.
 *
 * `html` ist ein Tagged Template: eingesetzte Werte werden automatisch
 * maskiert. Bereits erzeugtes HTML wird als Raw-Objekt durchgereicht.
 * Der einzige Weg, die Maskierung zu umgehen, ist raw() — dadurch ist
 * jede bewusste Ausnahme im Projekt per grep auffindbar.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Maskiert einen Text für die Verwendung in HTML. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Markierung für bereits fertiges, nicht zu maskierendes HTML. */
export class Raw {
  constructor(value) {
    this.value = String(value);
  }
  toString() {
    return this.value;
  }
}

/**
 * Kennzeichnet einen String als fertiges HTML.
 * Nur für Inhalte verwenden, die nachweislich sicher sind
 * (z. B. Ausgabe des Markdown-Renderers oder selbst erzeugtes Markup).
 */
export function raw(value) {
  return new Raw(value ?? '');
}

/** Wandelt einen beliebigen Wert in HTML um. */
function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/** Tagged Template für HTML mit automatischer Maskierung. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += renderValue(values[i]) + strings[i + 1];
  }
  return new Raw(out);
}

/** Fertiges HTML als String — der Abschluss jeder Template-Kette. */
export function render(node) {
  return renderValue(node);
}

/**
 * Baut eine Attributliste.
 * null / undefined / false lassen das Attribut weg, true setzt es ohne Wert.
 */
export function attrs(map) {
  const parts = [];
  for (const [name, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:.-]*$/.test(name)) {
      throw new Error(`Ungültiger Attributname: ${name}`);
    }
    if (value === true) {
      parts.push(name);
      continue;
    }
    parts.push(`${name}="${escapeHtml(value)}"`);
  }
  return parts.length ? raw(` ${parts.join(' ')}`) : raw('');
}

/** Setzt CSS-Klassen zusammen; falsche Werte werden verworfen. */
export function classNames(...values) {
  return values.flat(Infinity).filter(Boolean).join(' ') || null;
}

/**
 * Bettet JSON sicher in ein <script>-Element ein.
 * "<" wird escaped, damit der Inhalt das Script-Element nicht vorzeitig beendet.
 */
export function jsonScript(data) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return raw(json);
}
