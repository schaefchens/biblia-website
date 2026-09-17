/**
 * Formulare absenden.
 *
 * Ohne JavaScript werden die Formulare ganz normal abgeschickt und der
 * PHP-Endpunkt antwortet mit einer Dankeseite. Mit JavaScript bleibt man
 * auf der Seite und bekommt die Rückmeldung direkt.
 */
import { selection } from './selection.mjs';

/** Kennzeichnet die Anfrage als von dieser Seite kommend. */
const REQUEST_HEADER = 'X-Biblia-Request';

function setStatus(form, text, kind) {
  const status = form.querySelector('[data-form-status]');
  if (!status) return;
  status.textContent = text ?? '';
  status.dataset.kind = kind ?? '';
}

function showFieldErrors(form, errors) {
  for (const element of form.querySelectorAll('[data-field-error]')) {
    element.hidden = true;
    element.textContent = '';
  }
  for (const [name, message] of Object.entries(errors ?? {})) {
    const control = form.elements.namedItem(name);
    if (!control) continue;
    const error = control.closest('.field')?.querySelector('[data-field-error]');
    if (!error) continue;
    error.textContent = message;
    error.hidden = false;
    control.setAttribute('aria-invalid', 'true');
  }
}

async function submit(form, { extra = null, onSuccess = null, labels }) {
  const button = form.querySelector('[data-form-submit]');
  const body = new FormData(form);
  if (extra) body.append('items', JSON.stringify(extra));
  // Wie lange das Formular offen war — sehr schnelle Einsendungen sind
  // fast immer automatisiert.
  body.append('elapsed', String(Math.round((Date.now() - openedAt) / 1000)));

  button?.setAttribute('aria-disabled', 'true');
  setStatus(form, labels.sending, 'pending');

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body,
      headers: { Accept: 'application/json', [REQUEST_HEADER]: '1' },
      credentials: 'same-origin',
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      /* keine verwertbare Antwort */
    }

    if (response.ok && result.ok) {
      showFieldErrors(form, {});
      setStatus(form, '', '');
      form.hidden = true;
      const done = document.createElement('div');
      done.className = 'notice notice--accent';
      done.setAttribute('role', 'status');
      done.innerHTML = `<strong>${labels.successTitle}</strong><br>${labels.success}`;
      form.insertAdjacentElement('afterend', done);
      onSuccess?.();
      return;
    }

    if (response.status === 429) {
      setStatus(form, labels.rateLimit, 'error');
    } else if (result.errors) {
      showFieldErrors(form, result.errors);
      setStatus(form, labels.validation, 'error');
    } else {
      setStatus(form, labels.generic, 'error');
    }
  } catch {
    setStatus(form, labels.generic, 'error');
  } finally {
    button?.removeAttribute('aria-disabled');
  }
}

let openedAt = Date.now();

function labelsFrom(form) {
  return {
    sending: form.dataset.labelSending ?? '',
    successTitle: form.dataset.labelSuccessTitle ?? '',
    success: form.dataset.labelSuccess ?? '',
    generic: form.dataset.labelError ?? '',
    validation: form.dataset.labelValidation ?? '',
    rateLimit: form.dataset.labelRateLimit ?? '',
  };
}

export function initForms() {
  openedAt = Date.now();

  const orderForm = document.querySelector('[data-order-form]');
  if (orderForm) {
    orderForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const items = selection.all();
      if (items.length === 0) return;
      submit(orderForm, {
        extra: items,
        labels: labelsFrom(orderForm),
        onSuccess: () => selection.clear(),
      });
    });
  }

  const contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(contactForm, { labels: labelsFrom(contactForm) });
    });
  }
}
