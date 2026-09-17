/** Beispielinhalte. Nur für die Entwicklung — mit "npm run demo -- --remove" entfernbar. */

export const CATEGORIES = [
  { slug: 'glaube', de: 'Glaube', en: 'Faith' },
  { slug: 'jesus-christus', de: 'Jesus Christus', en: 'Jesus Christ' },
  { slug: 'lebensfragen', de: 'Lebensfragen', en: 'Questions of Life' },
  { slug: 'leid-und-hoffnung', de: 'Leid & Hoffnung', en: 'Suffering & Hope' },
  { slug: 'evangelisation', de: 'Evangelisation', en: 'Evangelism' },
  { slug: 'feste', de: 'Feste', en: 'Feasts' },
  { slug: 'kinder-und-familie', de: 'Kinder & Familie', en: 'Children & Family' },
];

export const TOPICS = [
  { slug: 'hoffnung', de: 'Hoffnung', en: 'Hope' },
  { slug: 'glaube', de: 'Glaube', en: 'Faith' },
  { slug: 'jesus-christus', de: 'Jesus Christus', en: 'Jesus Christ' },
  { slug: 'lebensfragen', de: 'Lebensfragen', en: 'Questions of Life' },
  { slug: 'leid', de: 'Leid', en: 'Suffering' },
  { slug: 'tod', de: 'Tod', en: 'Death' },
  { slug: 'vergebung', de: 'Vergebung', en: 'Forgiveness' },
  { slug: 'gebet', de: 'Gebet', en: 'Prayer' },
  { slug: 'familie', de: 'Familie', en: 'Family' },
  { slug: 'weihnachten', de: 'Weihnachten', en: 'Christmas' },
  { slug: 'ostern', de: 'Ostern', en: 'Easter' },
  { slug: 'auferstehung', de: 'Auferstehung', en: 'Resurrection' },
  { slug: 'angst', de: 'Angst', en: 'Fear' },
];

const TOPIC_INTRO = {
  de: (title) =>
    `Schriften zum Thema ${title}. Alle Flyer auf dieser Seite lassen sich online lesen, weitergeben und als Druckausgabe bestellen.`,
  en: (title) =>
    `Leaflets on the subject of ${title}. Everything on this page can be read online, shared and ordered in print.`,
};

export const taxonomyIntro = (lang, title) => TOPIC_INTRO[lang](title);

/** Die Beispiel-Flyer. */
export const FLYERS = [
  {
    id: 101,
    slug: 'hoffnung',
    category: 'leid-und-hoffnung',
    topics: ['hoffnung', 'leid', 'glaube'],
    tags: ['hoffnung', 'trost', 'zukunft'],
    bibleRefs: ['Römer 15,13', 'Jeremia 29,11'],
    featured: true,
    featuredOrder: 1,
    date: '2026-08-14',
    pages: 8,
    download: true,
    languages: {
      de: {
        title: 'Hoffnung',
        description:
          'Woran halten wir uns fest, wenn Pläne zerbrechen? Ein Flyer über eine Hoffnung, die nicht von den Umständen abhängt.',
        verse: 'Der Gott der Hoffnung aber erfülle euch mit aller Freude und Frieden im Glauben.',
        verseRef: 'Römer 15,13',
        body: 'Es gibt Tage, an denen tragen uns unsere Pläne. Und es gibt Tage, an denen tragen sie nicht mehr.\n\nDieser Flyer erzählt von einer Hoffnung, die nicht davon abhängt, wie ein Jahr verläuft — und die auch dann bleibt, wenn vieles andere geht.',
      },
      en: {
        title: 'Hope',
        description:
          'What do we hold on to when our plans fall apart? A leaflet about a hope that does not depend on circumstances.',
        verse: 'May the God of hope fill you with all joy and peace as you trust in him.',
        verseRef: 'Romans 15:13',
        body: 'Some days our plans carry us. Other days they no longer do.\n\nThis leaflet speaks of a hope that does not depend on how a year turns out — and that remains when much else goes.',
      },
    },
  },
  {
    id: 102,
    slug: 'wer-ist-jesus',
    category: 'jesus-christus',
    topics: ['jesus-christus', 'glaube'],
    tags: ['jesus', 'evangelium'],
    bibleRefs: ['Johannes 14,6'],
    featured: true,
    featuredOrder: 2,
    date: '2026-07-02',
    pages: 4,
    // Absichtlich unvollständig: EN-PDF vorhanden, EN-Beschreibung fehlt.
    // Damit zeigt npm run check genau die Warnung aus dem Konzept.
    incompleteEnglish: true,
    languages: {
      de: {
        title: 'Wer ist Jesus?',
        description: 'Eine kurze Einführung in die Person, um die sich der christliche Glaube dreht.',
        verse: 'Ich bin der Weg und die Wahrheit und das Leben.',
        verseRef: 'Johannes 14,6',
        body: 'Über kaum einen Menschen wurde so viel geschrieben. Und über kaum einen so unterschiedlich geurteilt.\n\nDieser Flyer stellt keine fertige Antwort vor, sondern die Frage selbst — so, wie sie im Neuen Testament gestellt wird.',
      },
      en: {
        title: 'Who is Jesus?',
        description: '',
        verse: 'I am the way and the truth and the life.',
        verseRef: 'John 14:6',
        body: 'Few people have been written about so much. And few judged so differently.',
      },
    },
  },
  {
    id: 103,
    slug: 'vergebung',
    category: 'lebensfragen',
    topics: ['vergebung', 'lebensfragen'],
    tags: ['vergebung', 'schuld'],
    bibleRefs: ['Kolosser 3,13'],
    date: '2026-06-18',
    pages: 1,
    languages: {
      de: {
        title: 'Vergebung',
        description: 'Was geschieht, wenn Schuld nicht das letzte Wort behält. Ein einseitiger Flyer zum Weitergeben.',
        verse: 'Ertragt einander und vergebt einander.',
        verseRef: 'Kolosser 3,13',
        body: 'Manches lässt sich nicht wiedergutmachen. Vergebung behauptet nicht, es wäre nicht geschehen — sie entscheidet nur, dass es nicht das Letzte bleibt.',
      },
    },
  },
  {
    id: 104,
    slug: 'weihnachten',
    category: 'feste',
    topics: ['weihnachten', 'jesus-christus', 'familie'],
    tags: ['weihnachten', 'advent'],
    bibleRefs: ['Lukas 2,11'],
    featured: true,
    featuredOrder: 3,
    date: '2026-05-30',
    pages: 6,
    download: true,
    languages: {
      de: {
        title: 'Weihnachten',
        description: 'Warum ein Kind in einer Futterkrippe zwei Jahrtausende später noch zählt.',
        verse: 'Euch ist heute der Retter geboren.',
        verseRef: 'Lukas 2,11',
        body: 'Weihnachten ist gut eingerichtet: Lichter, Termine, Erwartungen.\n\nDer Anlass selbst ist erstaunlich schlicht geblieben — ein Kind, eine Futterkrippe, ein paar Hirten.',
      },
      en: {
        title: 'Christmas',
        description: 'Why a child in a feeding trough still matters two thousand years later.',
        verse: 'Today a Saviour has been born to you.',
        verseRef: 'Luke 2:11',
        body: 'Christmas is well furnished: lights, dates, expectations.\n\nThe occasion itself has stayed remarkably plain.',
      },
    },
  },
  {
    id: 105,
    slug: 'leid-und-trost',
    category: 'leid-und-hoffnung',
    topics: ['leid', 'tod', 'hoffnung'],
    tags: ['trauer', 'trost'],
    bibleRefs: ['Psalm 34,19'],
    date: '2026-04-11',
    pages: 4,
    languages: {
      de: {
        title: 'Leid und Trost',
        description: 'Für Zeiten, in denen Erklärungen nicht mehr helfen. Gedanken für Trauernde und ihre Angehörigen.',
        verse: 'Der Herr ist nahe denen, die zerbrochenen Herzens sind.',
        verseRef: 'Psalm 34,19',
        body: 'Trost, der zu früh kommt, tröstet nicht.\n\nDieser Flyer versucht darum nichts zu erklären. Er bleibt bei dem, was bleibt, wenn Erklärungen aufhören.',
      },
    },
  },
  {
    id: 106,
    slug: 'gebet',
    category: 'glaube',
    topics: ['gebet', 'glaube'],
    tags: ['gebet'],
    bibleRefs: ['Matthäus 6,6'],
    date: '2026-03-05',
    pages: 2,
    languages: {
      de: {
        title: 'Beten — wie geht das?',
        description: 'Eine kurze, praktische Einführung für alle, die nie gelernt haben zu beten.',
        verse: 'Wenn du betest, geh in dein Kämmerlein.',
        verseRef: 'Matthäus 6,6',
        body: 'Beten ist kein Können. Es ist Reden — mit jemandem, von dem man annimmt, dass er zuhört.',
      },
      en: {
        title: 'How do you pray?',
        description: 'A short, practical introduction for anyone who never learned to pray.',
        verse: 'When you pray, go into your room.',
        verseRef: 'Matthew 6:6',
        body: 'Prayer is not a skill. It is speaking with someone you assume is listening.',
      },
    },
  },
  {
    id: 107,
    slug: 'auferstehung',
    category: 'feste',
    topics: ['auferstehung', 'ostern', 'tod', 'hoffnung'],
    tags: ['ostern', 'auferstehung'],
    bibleRefs: ['1. Korinther 15,20'],
    date: '2026-02-20',
    pages: 8,
    languages: {
      de: {
        title: 'Auferstehung',
        description: 'Die Behauptung, mit der das Christentum steht und fällt — und was von ihr abhängt.',
        verse: 'Nun aber ist Christus auferstanden von den Toten.',
        verseRef: '1. Korinther 15,20',
        body: 'Das Christentum stellt eine überprüfbare Behauptung auf: dass ein Toter wieder lebte.\n\nAlles Weitere hängt daran. Dieser Flyer nimmt die Behauptung ernst genug, um sie zu untersuchen.',
      },
    },
  },
  {
    id: 108,
    slug: 'lebensfragen',
    category: 'lebensfragen',
    topics: ['lebensfragen', 'angst', 'glaube'],
    tags: ['sinn', 'fragen'],
    bibleRefs: ['Prediger 3,11'],
    date: '2026-01-15',
    // Gefalteter Dreitafel-Flyer im Querformat: das Titelblatt ist das
    // rechte Drittel der ersten Seite. Prüft den Cover-Ausschnitt.
    folded: true,
    pages: 2,
    languages: {
      de: {
        title: 'Große Fragen',
        description: 'Woher, wozu, wohin. Ein Falt-Flyer über die Fragen, die sich nicht wegorganisieren lassen.',
        verse: 'Er hat die Ewigkeit in ihr Herz gelegt.',
        verseRef: 'Prediger 3,11',
        body: 'Es gibt Fragen, die kommen nicht dann, wenn man Zeit für sie hat.\n\nDieser Flyer stellt sie trotzdem — ohne Eile und ohne fertige Antwort.',
      },
    },
  },
];
