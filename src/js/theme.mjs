/**
 * Hell / Dunkel / System.
 *
 * Die Standardeinstellung ist "System". Eine ausdrückliche Wahl wird im
 * Browser gespeichert und beim nächsten Besuch schon vor dem Zeichnen
 * angewendet (siehe das kleine Skript im <head>).
 */
const STORAGE_KEY = 'biblia:theme';
const VALUES = ['system', 'light', 'dark'];

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return VALUES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function store(value) {
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Privater Modus oder blockierter Speicher — dann gilt nur diese Sitzung. */
  }
}

function apply(value) {
  if (value === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', value);
}

export function initTheme() {
  const current = readStored();
  apply(current);

  for (const group of document.querySelectorAll('[data-theme-switcher]')) {
    group.hidden = false;
  }

  for (const select of document.querySelectorAll('[data-theme-select]')) {
    select.value = current;
    select.addEventListener('change', () => {
      const value = VALUES.includes(select.value) ? select.value : 'system';
      apply(value);
      store(value);
      for (const other of document.querySelectorAll('[data-theme-select]')) {
        other.value = value;
      }
    });
  }
}
