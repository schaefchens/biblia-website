/**
 * Suchen und Filtern im Archiv.
 *
 * Die Liste steht bereits vollständig im HTML und ist auch ohne dieses
 * Skript brauchbar. Erst wenn jemand sucht oder filtert, wird sie durch
 * das Ergebnis ersetzt; beim Zurücksetzen erscheint wieder die
 * ursprüngliche, seitenweise Liste.
 *
 * Der Zustand steht in der Adresse, damit ein Suchergebnis weitergegeben
 * werden kann.
 */

/** Umlaute und Akzente vereinheitlichen, damit "Grosse" auch "Große" findet. */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function initSearch() {
  const bar = document.querySelector('[data-filterbar]');
  const list = document.querySelector('[data-flyer-list]');
  const countElement = document.querySelector('[data-result-count]');
  if (!bar || !list) return;

  const source = bar.dataset.indexUrl;
  if (!source) return;

  const input = bar.querySelector('[data-search-input]');
  const resetButton = bar.querySelector('[data-filter-reset]');
  const pagination = document.querySelector('.pagination');
  const originalList = list.innerHTML;

  const labels = {
    one: bar.dataset.labelResultOne ?? '{n}',
    other: bar.dataset.labelResultOther ?? '{n}',
    none: bar.dataset.labelNone ?? '',
    noneHint: bar.dataset.labelNoneHint ?? '',
    all: bar.dataset.labelAll ?? '',
    topic: bar.dataset.labelTopic ?? '',
    category: bar.dataset.labelCategory ?? '',
    cover: bar.dataset.labelCover ?? '{title}',
  };

  let index = null;
  let loading = null;

  /** Lädt den Index einmalig. */
  function load() {
    if (index) return Promise.resolve(index);
    loading ??= fetch(source)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        index = data;
        return data;
      })
      .catch(() => null);
    return loading;
  }

  /** Baut die beiden Auswahlfelder aus dem Index. */
  function buildFilters(data) {
    const make = (name, label, options) => {
      if (options.length === 0) return null;
      const wrapper = document.createElement('label');
      wrapper.className = 'filterbar__select';

      const caption = document.createElement('span');
      caption.className = 'visually-hidden';
      caption.textContent = label;

      const select = document.createElement('select');
      select.dataset.filter = name;

      const first = document.createElement('option');
      first.value = '';
      first.textContent = `${label}: ${labels.all}`;
      select.append(first);

      for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.append(option);
      }

      wrapper.append(caption, select);
      return wrapper;
    };

    const topic = make('topic', labels.topic, data.topics ?? []);
    const category = make('category', labels.category, data.categories ?? []);
    if (category) bar.insertBefore(category, resetButton);
    if (topic) bar.insertBefore(topic, resetButton);
  }

  /** Aktueller Zustand aus der Adresse. */
  function readState() {
    const params = new URLSearchParams(window.location.search);
    return {
      query: params.get('q') ?? '',
      topic: params.get('thema') ?? '',
      category: params.get('kategorie') ?? '',
    };
  }

  function writeState(state) {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.topic) params.set('thema', state.topic);
    if (state.category) params.set('kategorie', state.category);
    const search = params.toString();
    history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }

  const isActive = (state) => Boolean(state.query || state.topic || state.category);

  /** Wendet den Zustand auf die Liste an. */
  function apply(state) {
    if (!isActive(state)) {
      list.innerHTML = originalList;
      if (pagination) pagination.hidden = false;
      if (resetButton) resetButton.hidden = true;
      if (countElement && countElement.dataset.original) {
        countElement.textContent = countElement.dataset.original;
      }
      return;
    }

    if (!index) return;
    if (pagination) pagination.hidden = true;
    if (resetButton) resetButton.hidden = false;

    const needles = normalize(state.query).split(/\s+/).filter(Boolean);
    const results = index.entries.filter((entry) => {
      const [, slug, title, text, category, topics, tags] = entry;
      if (state.category && category !== state.category) return false;
      if (state.topic && !topics.includes(state.topic)) return false;
      if (needles.length === 0) return true;
      // Teilwortsuche: im Deutschen findet man "Hoffnung" sonst nicht in
      // "Hoffnungslosigkeit".
      const haystack = normalize([title, text, slug, topics.join(' '), tags.join(' ')].join(' '));
      return needles.every((needle) => haystack.includes(needle));
    });

    render(results);
  }

  function render(results) {
    const count = results.length;
    if (countElement) {
      const template = count === 1 ? labels.one : labels.other;
      countElement.textContent = template.replace('{n}', String(count));
    }

    if (count === 0) {
      list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty';
      const first = document.createElement('p');
      first.textContent = labels.none;
      const second = document.createElement('p');
      second.className = 'card__meta';
      second.textContent = labels.noneHint;
      empty.append(first, second);
      list.append(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const [, slug, title, , , , , cover, aspect] of results) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = `${base}${slug}/`;

      const media = document.createElement('span');
      media.className = 'card__media';
      if (aspect) media.style.setProperty('--card-aspect', aspect);

      if (cover) {
        const image = document.createElement('img');
        image.className = 'card__image';
        image.src = cover;
        image.alt = labels.cover.replace('{title}', title);
        image.loading = 'lazy';
        image.decoding = 'async';
        media.append(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'card__placeholder';
        placeholder.textContent = title;
        media.append(placeholder);
      }

      const heading = document.createElement('h3');
      heading.className = 'card__title';
      heading.textContent = title;

      card.append(media, heading);
      grid.append(card);
    }

    list.innerHTML = '';
    list.append(grid);
  }

  const base = bar.dataset.flyerBase ?? '';

  if (countElement) countElement.dataset.original = countElement.textContent.trim();

  // Erst jetzt einblenden: ohne JavaScript wäre die Leiste wirkungslos.
  bar.hidden = false;

  let timer = null;
  const update = () => {
    const state = {
      query: input?.value ?? '',
      topic: bar.querySelector('[data-filter="topic"]')?.value ?? '',
      category: bar.querySelector('[data-filter="category"]')?.value ?? '',
    };
    writeState(state);
    apply(state);
  };

  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => load().then(update), 160);
  });

  bar.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement && event.target.dataset.filter) {
      load().then(update);
    }
  });

  resetButton?.addEventListener('click', () => {
    if (input) input.value = '';
    for (const select of bar.querySelectorAll('[data-filter]')) select.value = '';
    update();
  });

  // Zustand aus der Adresse wiederherstellen.
  const initial = readState();
  if (isActive(initial)) {
    load().then((data) => {
      if (!data) return;
      buildFilters(data);
      if (input) input.value = initial.query;
      const topicSelect = bar.querySelector('[data-filter="topic"]');
      const categorySelect = bar.querySelector('[data-filter="category"]');
      if (topicSelect) topicSelect.value = initial.topic;
      if (categorySelect) categorySelect.value = initial.category;
      apply(initial);
    });
  } else {
    load().then((data) => data && buildFilters(data));
  }
}
