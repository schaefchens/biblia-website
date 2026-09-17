/**
 * Einstiegspunkt für das clientseitige JavaScript.
 *
 * Grundsatz: die Seite ist ohne dieses Skript vollständig lesbar und
 * bedienbar. Alles hier verbessert nur die Handhabung.
 */
import { initTheme } from './theme.mjs';
import { initReader } from './reader.mjs';
import { initLanguageBanner } from './lang.mjs';
import { initSelection } from './selection.mjs';
import { initShare } from './share.mjs';
import { initForms } from './forms.mjs';
import { initSearch } from './search.mjs';

initTheme();
initLanguageBanner();
initReader();
initSelection();
initShare();
initForms();
initSearch();
