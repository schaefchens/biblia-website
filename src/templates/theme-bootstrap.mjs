/**
 * Dieses Skript läuft als erstes im <head>, noch bevor etwas gezeichnet wird.
 * Ohne es würde bei gewähltem Dunkelmodus kurz die helle Seite aufblitzen.
 *
 * Es steht als Zeichenkette hier, weil der Build daraus den CSP-Hash berechnet.
 */
export const THEME_STORAGE_KEY = 'biblia:theme';

export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
