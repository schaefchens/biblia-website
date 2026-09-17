/**
 * Teilen.
 *
 * Wo vorhanden, wird die Freigabe des Betriebssystems benutzt — dort
 * erscheinen WhatsApp, Signal, Telegram und alles andere, was installiert
 * ist. Sonst öffnet sich ein kleines Menü mit WhatsApp, Link kopieren und
 * QR-Code.
 *
 * Es wird ausdrücklich nicht versprochen, einen WhatsApp-Status automatisch
 * zu erzeugen: das ist technisch nicht zuverlässig möglich.
 */
function openMenu(button, data, labels) {
  const existing = document.querySelector('[data-share-menu]');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'share-menu';
  menu.setAttribute('data-share-menu', '');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', labels.share);

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

  const close = (event) => {
    if (menu.contains(event.target) || button.contains(event.target)) return;
    menu.remove();
    document.removeEventListener('click', close);
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

export function initShare() {
  const buttons = [...document.querySelectorAll('[data-share]')];
  if (buttons.length === 0) return;

  for (const button of buttons) {
    const data = {
      title: button.dataset.shareTitle ?? document.title,
      text: button.dataset.shareText ?? '',
      url: button.dataset.shareUrl ?? window.location.href,
      qr: button.dataset.shareQr ?? null,
    };
    const labels = {
      share: button.dataset.labelShare ?? 'Teilen',
      whatsapp: button.dataset.labelWhatsapp ?? 'WhatsApp',
      copy: button.dataset.labelCopy ?? 'Link kopieren',
      copied: button.dataset.labelCopied ?? 'Kopiert',
      qr: button.dataset.labelQr ?? 'QR-Code',
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
