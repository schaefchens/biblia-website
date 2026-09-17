import { html, attrs } from '../../scripts/lib/html.mjs';

/** Ein Formularfeld mit Beschriftung und Platz für eine Fehlermeldung. */
export function field(
  { id, name, label, type = 'text', required = false, autocomplete = null, rows = null, span = 1 },
) {
  const control =
    rows !== null
      ? html`<textarea
          class="field__control"
          id="${id}"
          name="${name}"
          rows="${rows}"
          ${attrs({ required: required || null, autocomplete, 'aria-describedby': `${id}-fehler` })}
        ></textarea>`
      : html`<input
          class="field__control"
          id="${id}"
          name="${name}"
          type="${type}"
          ${attrs({ required: required || null, autocomplete, 'aria-describedby': `${id}-fehler` })}
        />`;

  return html`
    <div class="field" ${attrs({ style: span > 1 ? `grid-column: span ${span}` : null })}>
      <label class="field__label" for="${id}">${label}</label>
      ${control}
      <p class="field__error" id="${id}-fehler" data-field-error hidden></p>
    </div>
  `;
}

/**
 * Unsichtbares Feld gegen automatisierte Einsendungen.
 * Menschen füllen es nie aus, viele Programme schon.
 */
export function honeypot() {
  return html`
    <div class="honeypot" aria-hidden="true">
      <label for="webseite">Bitte dieses Feld frei lassen</label>
      <input id="webseite" name="website" type="text" tabindex="-1" autocomplete="off" />
    </div>
  `;
}
