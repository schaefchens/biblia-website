/**
 * Blätterbare Vollbild-Leseansicht.
 *
 * Grundlage ist die bereits im HTML stehende Bildfolge. Ohne dieses Skript
 * bleibt sie eine schlichte, funktionierende Galerie — deshalb wird hier
 * nichts erzeugt, sondern nur umgeschaltet.
 *
 * Die aktuelle Seite steht als "#p=4" in der Adresse. Der Schlüssel ist
 * absichtlich nicht übersetzt: ein geteilter Link soll in jeder Sprache
 * dieselbe Seite öffnen.
 */
const HASH_PATTERN = /^#p=(\d+)$/;

export function initReader() {
  const root = document.querySelector('[data-reader]');
  if (!root) return;

  const pages = [...root.querySelectorAll('[data-reader-page]')];
  if (pages.length === 0) return;

  const stage = root.querySelector('[data-reader-stage]');
  const nav = root.querySelector('[data-reader-nav]');
  const counter = root.querySelector('[data-reader-counter]');
  const previousButton = root.querySelector('[data-reader-prev]');
  const nextButton = root.querySelector('[data-reader-next]');
  const zoomButton = root.querySelector('[data-reader-zoom]');
  const total = pages.length;

  const template = counter?.textContent?.trim() ?? '';
  const counterFor = (current) =>
    template ? template.replace(/\d+/, String(current)).replace(/(\d+)(?!.*\d)/, String(total)) : '';

  let current = 1;
  let zoomed = false;

  root.classList.add('is-paged');
  if (nav) nav.hidden = false;
  if (zoomButton) zoomButton.hidden = false;

  function show(index, { updateHash = true } = {}) {
    current = Math.min(Math.max(index, 1), total);

    for (const page of pages) {
      const number = Number(page.dataset.readerPage);
      page.classList.toggle('is-current', number === current);
      // Die Nachbarseiten schon laden, damit das Blättern nicht wartet.
      if (Math.abs(number - current) <= 1) {
        for (const img of page.querySelectorAll('img[loading="lazy"]')) {
          img.loading = 'eager';
        }
      }
    }

    if (counter) counter.textContent = counterFor(current);
    if (previousButton) previousButton.disabled = current === 1;
    if (nextButton) nextButton.disabled = current === total;

    setZoom(false);

    if (updateHash) {
      // replaceState statt pushState: sonst bräuchte man bei einem Flyer
      // mit 40 Seiten 40 Mal "Zurück", um die Leseansicht zu verlassen.
      const hash = current === 1 ? ' ' : `#p=${current}`;
      history.replaceState(null, '', current === 1 ? window.location.pathname : hash);
    }
  }

  function setZoom(value) {
    zoomed = value;
    root.classList.toggle('is-zoomed', zoomed);
    if (zoomButton) zoomButton.setAttribute('aria-pressed', String(zoomed));
  }

  const next = () => show(current + 1);
  const previous = () => show(current - 1);

  previousButton?.addEventListener('click', previous);
  nextButton?.addEventListener('click', next);
  zoomButton?.addEventListener('click', () => setZoom(!zoomed));

  // Tastatur
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        event.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        previous();
        break;
      case 'Home':
        event.preventDefault();
        show(1);
        break;
      case 'End':
        event.preventDefault();
        show(total);
        break;
      case 'Escape':
        if (zoomed) {
          event.preventDefault();
          setZoom(false);
        } else {
          root.querySelector('[data-reader-close]')?.click();
        }
        break;
      default:
        break;
    }
  });

  // Tippen links und rechts zum Blättern
  stage?.addEventListener('click', (event) => {
    if (zoomed) return;
    if (event.target instanceof HTMLElement && event.target.closest('a, button')) return;
    const bounds = stage.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width;
    if (position < 0.22) previous();
    else if (position > 0.78) next();
  });

  // Doppeltippen vergrößert
  stage?.addEventListener('dblclick', (event) => {
    event.preventDefault();
    setZoom(!zoomed);
  });

  // Wischen auf dem Telefon
  let touchStartX = 0;
  let touchStartY = 0;
  let touchCount = 0;

  stage?.addEventListener(
    'touchstart',
    (event) => {
      touchCount = event.touches.length;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    },
    { passive: true },
  );

  stage?.addEventListener(
    'touchend',
    (event) => {
      if (zoomed || touchCount !== 1) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      // Nur waagerechte Gesten auswerten, damit Scrollen nicht blättert.
      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
      if (deltaX < 0) next();
      else previous();
    },
    { passive: true },
  );

  // Adresse auswerten und auf Änderungen reagieren
  const fromHash = () => {
    const match = HASH_PATTERN.exec(window.location.hash);
    return match ? Number(match[1]) : 1;
  };
  window.addEventListener('hashchange', () => show(fromHash(), { updateHash: false }));

  show(fromHash(), { updateHash: false });
}
