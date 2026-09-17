/**
 * npm run preview
 *
 * Lokaler Server für den Ordner dist/.
 *
 * Wichtig: die Vorschau läuft unter demselben Unterverzeichnis wie der
 * Server (z. B. http://localhost:8080/v3/). Würde sie im Wurzelverzeichnis
 * ausliefern, blieben Fehler mit dem Basispfad bis zum ersten Hochladen
 * unentdeckt.
 *
 *   --port 8080     Anderer Port
 *   --no-build      Vorhandenes dist/ verwenden, nicht neu bauen
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DIR } from './lib/paths.mjs';
import { isProtectedPath } from './lib/emit.mjs';
import { loadConfig } from './lib/config.mjs';
import { blank, color, heading, info, ok, runMain, step, warn } from './lib/log.mjs';
import { build } from './build.mjs';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8080;
const skipBuild = args.includes('--no-build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/** Startet den PHP-Entwicklungsserver für die API, falls PHP vorhanden ist. */
function startPhp(apiPort) {
  const apiDir = path.join(DIR.dist, 'api');
  if (!fs.existsSync(apiDir)) return null;
  try {
    const child = spawn('php', ['-S', `127.0.0.1:${apiPort}`, '-t', DIR.dist], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    child.on('error', () => {});
    return child;
  } catch {
    return null;
  }
}

/** Reicht eine Anfrage an den PHP-Server weiter. */
function proxyToPhp(request, response, apiPort, targetPath) {
  const proxied = http.request(
    {
      host: '127.0.0.1',
      port: apiPort,
      method: request.method,
      path: targetPath,
      headers: { ...request.headers, host: `127.0.0.1:${apiPort}` },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    },
  );
  proxied.on('error', () => {
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('PHP-Server nicht erreichbar.');
  });
  request.pipe(proxied);
}

runMain(async () => {
  if (!skipBuild) {
    await build({ quiet: false });
  }

  const config = loadConfig();
  const basePath = config.basePath;
  const apiPort = port + 1;
  const php = startPhp(apiPort);

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);

    // Ohne Basispfad aufgerufen: auf die richtige Adresse leiten, damit man
    // die Website genauso sieht wie später auf dem Server.
    if (basePath !== '/' && !pathname.startsWith(basePath)) {
      const target = pathname === '/' ? basePath : `${basePath.slice(0, -1)}${pathname}`;
      response.writeHead(302, { location: target });
      response.end();
      return;
    }

    const relative = basePath === '/' ? pathname.slice(1) : pathname.slice(basePath.length);

    // Genau wie die .htaccess auf dem Server: die Laufzeitdaten sind
    // nicht über das Web erreichbar. Ohne diese Sperre würde die Vorschau
    // eine Sicherheit vortäuschen, die es nur auf dem Server gibt.
    if (isProtectedPath(relative)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('403');
      return;
    }

    if (php && relative.startsWith('api/') && relative.endsWith('.php')) {
      proxyToPhp(request, response, apiPort, `/${relative}${url.search}`);
      return;
    }

    const candidates = relative === '' || relative.endsWith('/')
      ? [`${relative}index.html`]
      : [relative, `${relative}/index.html`];

    for (const candidate of candidates) {
      const file = path.join(DIR.dist, candidate);
      if (!file.startsWith(DIR.dist)) break;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        // Verzeichnisse ohne abschliessenden Schrägstrich umleiten — genau
        // wie Apache es auf dem Server tut.
        if (candidate.endsWith('/index.html') && !pathname.endsWith('/') && relative !== '') {
          response.writeHead(301, { location: `${pathname}/${url.search}` });
          response.end();
          return;
        }
        response.writeHead(200, {
          'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-cache',
        });
        fs.createReadStream(file).pipe(response);
        return;
      }
    }

    const notFound = path.join(DIR.dist, '404.html');
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    if (fs.existsSync(notFound)) fs.createReadStream(notFound).pipe(response);
    else response.end('404');
  });

  await new Promise((resolve) => server.listen(port, resolve));

  heading('Vorschau');
  ok(`http://localhost:${port}${basePath}`);
  info(color.gray(`    Liefert den Ordner dist/ unter demselben Unterverzeichnis aus wie der Server.`));
  if (php) info(color.gray(`    PHP-Endpunkte werden an einen lokalen PHP-Server weitergereicht.`));
  else if (fs.existsSync(path.join(DIR.dist, 'api'))) warn('PHP ist nicht installiert — die Formulare lassen sich lokal nicht testen.');
  blank();
  info(color.gray('    Beenden mit Strg+C'));
  blank();

  const stop = () => {
    php?.kill();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await new Promise(() => {});
});
