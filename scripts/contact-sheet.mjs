/**
 * Draws all 242 glyphs on one page, twice each: bare, and with the flag poured in.
 *
 * The crop is a heuristic, and when a heuristic fails here it fails quietly — by drawing
 * a country nobody would recognise, next to an island nobody expected. There is no unit
 * test for "looks like Italy", so this is the check: open it and look.
 *
 *   node scripts/contact-sheet.mjs && open sheet.html
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CODES, load, toSvg } = await import(join(root, 'dist', 'index.js'));
const { loadFlag } = await import(join(root, 'dist', 'flags.js'));

const cells = [];
for (const code of CODES) {
  const shape = await load(code);
  const flag = await loadFlag(code);
  cells.push(
    `<figure>${toSvg(shape, { size: '42px', className: 'bare' })}` +
      `${toSvg(shape, { size: '42px', flag })}<figcaption>${code}</figcaption></figure>`,
  );
}

await writeFile(
  join(root, 'sheet.html'),
  `<!doctype html><meta charset="utf-8"><title>geoglyph contact sheet</title><style>
    body { background: #fff; color: #111; font: 11px system-ui; margin: 16px }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px }
    figure { margin: 0; text-align: center; border: 1px solid #eee; padding: 6px }
    svg { vertical-align: middle }
    .bare { opacity: 0.5 }
    figcaption { margin-block-start: 4px; color: #666; letter-spacing: 0.08em }
  </style><main>${cells.join('')}</main>`,
);
console.log(`contact-sheet: ${String(CODES.length)} glyphs → sheet.html`);
