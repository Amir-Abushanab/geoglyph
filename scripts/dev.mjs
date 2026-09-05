/**
 * The playground: every glyph on one page, with every option live.
 *
 * `contact-sheet.mjs` answers one question — does the crop look right — once, as a flat
 * file. This answers the other one, what the options actually do, by serving the built
 * package to a browser and letting you turn the knobs. The page imports `/dist/index.js`
 * and the generated registries straight off disk, so what is on screen is the real
 * `toSvg` output over the real modules, not a drawing of them.
 *
 * There is no bundler here because there is nothing to bundle: every import in this
 * package is a relative path to a file that exists, which is exactly what a browser
 * wants. So the whole dev story is a static file server, a `tsc --watch` beside it, and
 * an event stream to say when to reload.
 *
 *   node scripts/dev.mjs [--port 5173] [--open]
 */
import { spawn } from 'node:child_process';
import { createReadStream, watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const given = (name) => args.includes(name);
const valueOf = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};

const FIRST_PORT = Number(valueOf('--port', process.env.PORT ?? '5173'));
/** How many ports up to try before giving up, so a second window does not just fail. */
const PORT_TRIES = 10;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/* Reached through `process.execPath` rather than `node_modules/.bin`, which is a shell
   shim on one platform and a symlink on another. */
const TSC = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const BUILD = ['-p', 'tsconfig.build.json'];

const runTsc = (extra) =>
  spawn(process.execPath, [TSC, ...BUILD, ...extra], { cwd: root, stdio: 'inherit' });

/** The one-shot build first: the page imports `dist/`, so it has to exist before we listen. */
await new Promise((resolve, reject) => {
  runTsc([]).on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`tsc exited ${String(code)}`)),
  );
});

/* `--preserveWatchOutput` because the default clears the terminal on every rebuild, which
   takes the server's own URL with it. */
const watcher = runTsc(['--watch', '--preserveWatchOutput']);
const stop = () => {
  watcher.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

/*
 * Reload channel. `dist/` changes when tsc finishes a rebuild and `scripts/dev/` when the
 * page itself is edited; `generated/` is left out on purpose, since it only moves when you
 * run `pnpm vendor` and watching 726 files for that is not a trade worth making.
 *
 * Coalesced, because tsc writes a dozen files per rebuild and each one is an event.
 */
const listeners = new Set();
let pending;
const bump = () => {
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const client of listeners) client.write('data: reload\n\n');
  }, 80);
};
for (const dir of ['dist', join('scripts', 'dev')]) {
  watch(join(root, dir), { recursive: true }, bump);
}

async function serve(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/~reload') {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    response.write('retry: 500\n\n');
    listeners.add(response);
    request.on('close', () => listeners.delete(response));
    return;
  }

  const wanted = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  /* `normalize` resolves the `..` while the path is still rooted at `/`, so it cannot
     climb past it; the per-base prefix check below is the belt to that pair of braces. */
  const safe = normalize(wanted);

  /* The page's own files first, the repository behind them. That is the layout Pages will
     serve — `index.html` at the root with `dist/` and `generated/` beside it — so the
     relative paths in the page resolve here exactly as they will there, and neither copy
     has to know it is sitting under `/geoglyph/`. */
  let path = null;
  let info = null;
  for (const base of [join(root, 'scripts', 'dev'), root]) {
    const candidate = join(base, safe);
    if (candidate !== base && !candidate.startsWith(base + sep)) continue;
    try {
      const found = await stat(candidate);
      if (found.isFile()) {
        path = candidate;
        info = found;
        break;
      }
    } catch {
      // not under this base; try the next
    }
  }
  if (path === null || info === null) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`404 ${wanted}`);
    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(path).pipe(response);
}

const server = createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end('server error');
  });
});

const open = (url) => {
  const [command, ...rest] =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];
  spawn(command, rest, { stdio: 'ignore', detached: true }).unref();
};

/* Announced from the socket rather than from the number we asked for: the retry below
   registers a fresh `listen` each time, and a callback passed to it would survive the
   attempt that failed and report a port we are not on. */
server.on('listening', () => {
  const url = `http://localhost:${String(server.address().port)}`;
  console.log(`\n  geoglyph playground   ${url}`);
  console.log(`  watching src/ — save and the page reloads\n`);
  if (given('--open')) open(url);
});

const listen = (port) => {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < FIRST_PORT + PORT_TRIES) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  /* `localhost` rather than `127.0.0.1`, so that a dev server already sitting on `::1`
     collides here and we move up a port, instead of quietly binding the other family and
     handing you someone else's site at the URL we just printed. */
  server.listen(port, 'localhost');
};

listen(FIRST_PORT);
