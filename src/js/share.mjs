/**
 * Teilen.
 *
 * Wo vorhanden, wird die Freigabe des Betriebssystems benutzt — dort
 * erscheinen WhatsApp, Signal, Telegram und alles andere, was installiert
 * ist. Sonst öffnet sich ein kleines Menü mit WhatsApp, Link kopieren,
 * QR-Code und dem Bild im Hochformat.
 *
 * Es wird ausdrücklich nicht versprochen, einen WhatsApp-Status automatisch
 * zu erzeugen: das ist technisch nicht zuverlässig möglich. Das fertige
 * Bild wird aber angeboten — es lässt sich dann von Hand posten.
 */

/** Lädt ein Bild der eigenen Seite als Datei zum Weitergeben. */
async function fetchAsFile(url, name) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Bild nicht erreichbar');
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'image/webp' });
}

/** Kann das Betriebssystem Dateien entgegennehmen? */
function canShareFiles(file) {
  return Boolean(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
}

/**
 * Gibt das hochformatige Bild weiter.
 *
 * Auf dem Telefon landet es direkt in der Freigabe und damit einen Schritt
 * später im WhatsApp-Status. Wo das nicht geht, wird es in einem eigenen
 * Tab geöffnet — von dort lässt es sich sichern.
 */
async function shareStatusImage({ url, title, slug }) {
  try {
    const file = await fetchAsFile(url, `${slug || 'biblia'}.webp`);
    if (canShareFiles(file)) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (error) {
    if (error && error.name === 'AbortError') return true;
  }
  window.open(url, '_blank', 'noopener');
  return false;
}

function closeMenu(menu, button, { restoreFocus = false } = {}) {
  menu.remove();
  if (restoreFocus) button.focus();
}

function openMenu(button, data, labels) {
  const existing = document.querySelector('[data-share-menu]');
  if (existing) {
    const wasMine = existing.dataset.shareMenu === String(data.url);
    existing.remove();
    if (wasMine) return;
  }

  const menu = document.createElement('div');
  menu.className = 'share-menu';
  menu.setAttribute('data-share-menu', data.url);
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', labels.share);
  menu.tabIndex = -1;

  const makeButton = (text, onClick) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'share-menu__item';
    item.textContent = text;
    item.addEventListener('click', onClick);
    return item;
  };

  const whatsapp = document.createElement('a');
  whatsapp.className = 'share-menu__item';
  whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${data.text}\n${data.url}`)}`;
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener';
  whatsapp.textContent = labels.whatsapp;

  const copy = makeButton(labels.copy, async () => {
    try {
      await navigator.clipboard.writeText(data.url);
      copy.textContent = labels.copied;
    } catch {
      copy.textContent = data.url;
    }
  });

  menu.append(whatsapp, copy);

  // Das hochformatige Bild für Status-Beiträge. Wo das Betriebssystem
  // Dateien annimmt, wandert es direkt in die Freigabe; sonst wird es in
  // einem eigenen Tab geöffnet und lässt sich dort sichern.
  if (data.status) {
    menu.append(
      makeButton(labels.status, async () => {
        await shareStatusImage({ url: data.status, title: data.title, slug: data.slug });
        closeMenu(menu, button);
      }),
    );
  }

  if (data.qr) {
    const qr = makeButton(labels.qr, () => {
      const image = document.createElement('img');
      image.src = data.qr;
      image.alt = labels.qr;
      image.className = 'share-menu__qr';
      qr.replaceWith(image);
    });
    menu.append(qr);
  }

  button.insertAdjacentElement('afterend', menu);
  menu.querySelector('a, button')?.focus();

  const close = (event) => {
    if (menu.contains(event.target) || button.contains(event.target)) return;
    document.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey);
    closeMenu(menu, button);
  };

  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    document.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey);
    closeMenu(menu, button, { restoreFocus: true });
  };

  document.addEventListener('keydown', onKey);
  setTimeout(() => document.addEventListener('click', close), 0);
}

/**
 * Die eigene Schaltfläche für das Bild im Hochformat.
 *
 * Sie ist nötig, weil auf dem Telefon die Freigabe des Betriebssystems
 * sofort aufgeht und das Ersatzmenü — in dem das Bild sonst steht — gar
 * nicht erst erscheint. Gerade dort wird das Bild aber gebraucht.
 */
function initStatusButtons() {
  for (const button of document.querySelectorAll('[data-status-share]')) {
    const url = button.dataset.statusShare;
    if (!url) continue;
    button.hidden = false;
    button.addEventListener('click', () =>
      shareStatusImage({
        url,
        title: button.dataset.shareTitle ?? document.title,
        slug: button.dataset.shareSlug ?? '',
      }),
    );
  }
}

export function initShare() {
  initStatusButtons();

  const buttons = [...document.querySelectorAll('[data-share]')];
  if (buttons.length === 0) return;

  for (const button of buttons) {
    const data = {
      title: button.dataset.shareTitle ?? document.title,
      text: button.dataset.shareText ?? '',
      url: button.dataset.shareUrl ?? window.location.href,
      qr: button.dataset.shareQr || null,
      status: button.dataset.shareStatus || null,
      slug: button.dataset.shareSlug ?? '',
    };
    const labels = {
      share: button.dataset.labelShare ?? 'Teilen',
      whatsapp: button.dataset.labelWhatsapp ?? 'WhatsApp',
      copy: button.dataset.labelCopy ?? 'Link kopieren',
      copied: button.dataset.labelCopied ?? 'Kopiert',
      qr: button.dataset.labelQr ?? 'QR-Code',
      status: button.dataset.labelStatus ?? 'Bild teilen',
    };

    button.hidden = false;
    button.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: data.title, text: data.text, url: data.url });
          return;
        } catch (error) {
          // Abbruch durch die Person ist kein Fehler.
          if (error && error.name === 'AbortError') return;
        }
      }
      openMenu(button, data, labels);
    });
  }
}
