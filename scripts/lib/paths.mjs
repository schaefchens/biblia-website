/** Zentrale Verzeichnis- und Dateipfade des Projekts. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const DIR = {
  root: ROOT,
  config: path.join(ROOT, 'config'),
  content: path.join(ROOT, 'content'),
  pages: path.join(ROOT, 'content', 'pages'),
  flyers: path.join(ROOT, 'content', 'flyers'),
  topics: path.join(ROOT, 'content', 'topics'),
  categories: path.join(ROOT, 'content', 'categories'),
  src: path.join(ROOT, 'src'),
  templates: path.join(ROOT, 'src', 'templates'),
  components: path.join(ROOT, 'src', 'components'),
  css: path.join(ROOT, 'src', 'css'),
  js: path.join(ROOT, 'src', 'js'),
  i18n: path.join(ROOT, 'src', 'i18n'),
  scripts: path.join(ROOT, 'scripts'),
  server: path.join(ROOT, 'server'),
  generated: path.join(ROOT, 'generated'),
  cache: path.join(ROOT, 'generated', '.cache'),
  catalog: path.join(ROOT, 'generated', 'catalog'),
  searchIndex: path.join(ROOT, 'generated', 'search'),
  text: path.join(ROOT, 'generated', 'text'),
  dist: path.join(ROOT, 'dist'),
  printAssets: path.join(ROOT, 'print-assets'),
  appData: path.join(ROOT, 'app-data'),
};

export const FILE = {
  siteConfig: path.join(DIR.config, 'site.json'),
  sftpEnv: path.join(ROOT, 'sftp.env'),
  sftpEnvExample: path.join(ROOT, 'sftp.env.example'),
  packageJson: path.join(ROOT, 'package.json'),
  buildManifest: path.join(DIR.generated, 'build-manifest.json'),
};

/** Pfad relativ zum Projektverzeichnis — für lesbare Meldungen. */
export function rel(absolutePath) {
  const r = path.relative(ROOT, absolutePath);
  return r === '' ? '.' : r;
}
