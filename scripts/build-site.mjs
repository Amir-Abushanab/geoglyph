/**
 * Assembles the playground into a directory Pages can serve.
 *
 * The layout is the point. Pages puts the site under `/geoglyph/`, so nothing in the page
 * may start with a slash — and the page reaches the package through `./dist/index.js`,
 * which reaches the generated modules through `../generated/`. Both therefore have to sit
 * beside `index.html` rather than above it. `scripts/dev.mjs` serves the same shape, so
 * what you see locally is what deploys.
 *
 *   pnpm site && npx serve site
 */
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'site');

/* Everything in `scripts/dev` except the server's own concerns. */
const SKIP = new Set(['.DS_Store']);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of await readdir(join(root, 'scripts', 'dev'))) {
  if (SKIP.has(entry)) continue;
  await cp(join(root, 'scripts', 'dev', entry), join(OUT, entry), { recursive: true });
}
for (const dir of ['dist', 'generated']) {
  await cp(join(root, dir), join(OUT, dir), { recursive: true });
}

/* Pages runs Jekyll over an artifact unless told not to, and Jekyll drops files and
   directories whose names begin with an underscore. Nothing here starts with one today,
   but the flag costs a byte and the failure it prevents is a silent 404. */
await cp(join(root, 'NOTICE'), join(OUT, 'NOTICE'));
/* One copy at the repository root, shipped in the tarball and served at the site root, so
   an agent finds the same file whether it is reading node_modules or the deployed page. */
await cp(join(root, 'llms.txt'), join(OUT, 'llms.txt'));
const { writeFile } = await import('node:fs/promises');
await writeFile(join(OUT, '.nojekyll'), '');

let files = 0;
let bytes = 0;
const walk = async (dir) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      files += 1;
      bytes += (await stat(path)).size;
    }
  }
};
await walk(OUT);
console.log(`build-site: ${String(files)} files, ${String(Math.round(bytes / 1024))}KB → site/`);
