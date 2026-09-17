/**
 * "Meine Auswahl".
 *
 * Die Auswahl liegt ausschliesslich im Browser. Der Server erfährt erst
 * beim Absenden der Bestellanfrage davon — deshalb wird dafür auch kein
 * PHP gebraucht, solange nur ausgewählt wird.
 */
const STORAGE_KEY = 'biblia:selection';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && Number.isInteger(item.id) && typeof item.title === 'string')
      .map((item) => ({
        id: item.id,
        title: item.title,
        slug: typeof item.slug === 'string' ? item.slug : '',
        quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1,
      }));
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Privater Modus — die Auswahl gilt dann nur für diese Sitzung. */
  }
  notify(items);
}

const listeners = new Set();
const notify = (items) => {
  for (const listener of listeners) listener(items);
};

export const selection = {
  all: read,
  onChange(listener) {
    listeners.add(listener);
    listener(read());
  },
  add(item) {
    const items = read();
    const existing = items.find((entry) => entry.id === item.id);
    if (existing) existing.quantity += 1;
    else items.push({ ...item, quantity: 1 });
    write(items);
  },
  remove(id) {
    write(read().filter((entry) => entry.id !== id));
  },
  setQuantity(id, quantity) {
    const items = read();
    const entry = items.find((item) => item.id === id);
    if (!entry) return;
    entry.quantity = Math.max(1, Math.min(999, quantity));
    write(items);
  },
  clear() {
    write([]);
  },
  has(id) {
    return read().some((entry) => entry.id === id);
  },
};

/** Zähler in der Kopfzeile. */
function initBadge() {
  const badges = [...document.querySelectorAll('[data-selection-count]')];
  if (badges.length === 0) return;
  selection.onChange((items) => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    for (const badge of badges) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
  });
}

/** Die Schaltflächen "Druckausgabe bestellen" auf den Flyer-Seiten. */
function initButtons() {
  for (const button of document.querySelectorAll('[data-select-flyer]')) {
    const id = Number(button.dataset.selectFlyer);
    const title = button.dataset.selectTitle ?? '';
    const slug = button.dataset.selectSlug ?? '';
    const original = button.textContent.trim();
    const added = button.dataset.selectAdded ?? original;

    const refresh = () => {
      const inList = selection.has(id);
      button.setAttribute('aria-pressed', String(inList));
      button.textContent = inList ? added : original;
    };

    button.addEventListener('click', () => {
      if (selection.has(id)) selection.remove(id);
      else selection.add({ id, title, slug });
      refresh();
    });

    selection.onChange(refresh);
  }
}

/** Die Liste auf der Bestellseite. */
function initList() {
  const list = document.querySelector('[data-selection-list]');
  const empty = document.querySelector('[data-selection-empty]');
  const form = document.querySelector('[data-order-form]');
  if (!list) return;

  const labels = {
    quantity: list.dataset.labelQuantity ?? 'Anzahl',
    remove: list.dataset.labelRemove ?? 'Entfernen',
  };

  selection.onChange((items) => {
    list.textContent = '';

    for (const item of items) {
      const entry = document.createElement('li');
      entry.className = 'selection__item';

      const title = document.createElement('p');
      title.className = 'selection__title';
      title.textContent = item.title;

      const controls = document.createElement('div');
      controls.className = 'selection__controls';

      const quantityLabel = document.createElement('label');
      quantityLabel.className = 'selection__quantity';
      quantityLabel.textContent = labels.quantity;

      const quantity = document.createElement('input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.max = '999';
      quantity.value = String(item.quantity);
      quantity.inputMode = 'numeric';
      quantity.addEventListener('change', () => {
        selection.setQuantity(item.id, Number(quantity.value));
      });
      quantityLabel.append(quantity);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button--quiet';
      remove.textContent = labels.remove;
      remove.addEventListener('click', () => selection.remove(item.id));

      controls.append(quantityLabel, remove);
      entry.append(title, controls);
      list.append(entry);
    }

    const hasItems = items.length > 0;
    list.hidden = !hasItems;
    if (empty) empty.hidden = hasItems;
    if (form) form.hidden = !hasItems;
  });
}

export function initSelection() {
  initBadge();
  initButtons();
  initList();
}
