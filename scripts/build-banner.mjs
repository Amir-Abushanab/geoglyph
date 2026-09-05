/**
 * The social card and the README strip, both drawn out of the package itself.
 *
 * A banner that is hand-drawn goes stale the moment the crop changes. This one calls the
 * same `toSvg` over the same generated modules the page does, so if a glyph regresses the
 * card regresses with it and you find out at the top of a pull request.
 *
 * 1200×630 is the size every scraper crops to. PNG rather than SVG because a good number
 * of them will not fetch an SVG card at all.
 *
 * The strip is the same glyphs without the words, because a README already has a title
 * above it and does not need a second one inside a picture.
 *
 *   node scripts/build-banner.mjs
 */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const sharp = require('sharp');

const { load } = await import(join(root, 'dist', 'index.js'));
const { flagHref } = await import(join(root, 'dist', 'svg.js'));
const { loadFlagSvg } = await import(join(root, 'dist', 'flags-svg.js'));

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = '#101214';
const INK = '#e9e9e6';
const DIM = '#8d949b';
const ACCENT = '#6fcaa4';

/* Chosen to read at card size: outlines a person can name, and flags whose bands survive
   being poured into one. The vector tier, since this is rasterised once and kept. */
const CAST = ['PS', 'ES', 'NO', 'YE', 'BR', 'JP', 'IN', 'IT', 'CL', 'NZ', 'GB', 'EG'];
const SIZE = 108;
const GAP = 22;

/*
 * The one place the card does not use `toSvg` verbatim. The package clips with
 * `clip-path: path('…')`, which every browser understands and librsvg — what sharp renders
 * with — does not: it ignores the property and paints the flag as the rectangle it started
 * as. So the card emits the same outline as a `<clipPath>` element instead. Same geometry,
 * same flags, same `d` off the same generated module; only the spelling of the clip differs,
 * and ids are safe here because this file is one image with nothing else in it.
 */
const glyphs = [];
for (const [i, code] of CAST.entries()) {
  const shape = await load(code);
  if (shape === null) continue;
  const flag = await loadFlagSvg(code);
  const id = `clip-${String(i)}`;
  /* A shape's viewBox is in degrees, so Palestine's is barely a unit across. librsvg
     rasterises a nested `<image>` in user units before scaling it, which at that size is
     about one pixel of flag smeared over the whole country. Blowing the user space up to a
     fixed 200 gives every glyph the same generous resolution regardless of how big the
     country is; the transform cancels it out, so nothing about the geometry changes. */
  const [, , w, h] = shape.viewBox.split(' ').map(Number);
  const k = 200 / Math.max(w, h);
  const box = `viewBox="0 0 ${String(w * k)} ${String(h * k)}" width="${String(SIZE)}" height="${String(SIZE)}"`;
  /* The scale goes on the clip geometry, not on a group around the image. Inside a scaled
     group the image is still only a degree or so wide in its own units, which is the
     resolution librsvg gives it — the whole point is to hand the image a big box. */
  glyphs.push(
    `<svg ${box}>` +
      (flag === null
        ? `<path fill="${INK}" transform="scale(${String(k)})" d="${shape.d}"/>`
        : `<defs><clipPath id="${id}">` +
          `<path transform="scale(${String(k)})" d="${shape.d}"/></clipPath></defs>` +
          `<image clip-path="url(#${id})" href="${flagHref(flag).replaceAll('"', '&quot;')}"` +
          ` x="0" y="0" width="${String(w * k)}" height="${String(h * k)}" preserveAspectRatio="none"/>`) +
      `</svg>`,
  );
}

const perRow = 6;
const rows = Math.ceil(glyphs.length / perRow);
const gridWidth = perRow * SIZE + (perRow - 1) * GAP;
const left = (WIDTH - gridWidth) / 2;
const top = HEIGHT - rows * SIZE - (rows - 1) * GAP - 74;

const placed = glyphs
  .map((svg, i) => {
    const x = left + (i % perRow) * (SIZE + GAP);
    const y = top + Math.floor(i / perRow) * (SIZE + GAP);
    return `<g transform="translate(${String(x)} ${String(y)})" fill="${INK}" color="${INK}">${svg}</g>`;
  })
  .join('');

const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const card =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${String(HEIGHT)}" viewBox="0 0 ${String(WIDTH)} ${String(HEIGHT)}">` +
  `<rect width="${String(WIDTH)}" height="${String(HEIGHT)}" fill="${PAPER}"/>` +
  // The same globe as the favicon and the page's own wordmark.
  `<g transform="translate(72 66)" fill="none" stroke="${ACCENT}" stroke-width="1.7">` +
  `<g transform="scale(2.1)">` +
  `<circle cx="12" cy="12" r="8.6"/><ellipse cx="12" cy="12" rx="8.6" ry="3.7"/>` +
  `<path d="M12 3.4a4.4 8.6 0 0 0 0 17.2a4.4 8.6 0 0 0 0-17.2"/></g></g>` +
  `<text x="140" y="105" font-family="${font}" font-size="58" font-weight="700" fill="${INK}">geoglyph</text>` +
  `<text x="74" y="168" font-family="${font}" font-size="28" fill="${DIM}">` +
  `Every country as a mark the size of a letter.</text>` +
  `<text x="74" y="212" font-family="${font}" font-size="21" fill="${DIM}">` +
  `242 outlines, cropped to the landmass each one is recognised by — and its flag to pour inside.</text>` +
  placed +
  `</svg>`;

const render = async (svg, w, h, name) => {
  const png = await sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(root, 'scripts', 'dev', name), png);
  return `${name} ${String(w)}×${String(h)} ${String(Math.round(png.length / 1024))}KB`;
};

/* One row on the same dark ground as the card. Transparent would be the obvious choice and
   is the wrong one: half these flags have a white band, and a README is read on whichever
   theme the reader is in — on GitHub's light one, Japan loses everything but the disc and
   Yemen comes apart. A fixed ground is legible in both. */
const STRIP_H = SIZE + 28;
const stripWidth = glyphs.length * SIZE + (glyphs.length - 1) * GAP + 48;
const strip =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${String(stripWidth)}" height="${String(STRIP_H)}" ` +
  `viewBox="0 0 ${String(stripWidth)} ${String(STRIP_H)}">` +
  `<rect width="${String(stripWidth)}" height="${String(STRIP_H)}" rx="10" fill="${PAPER}"/>` +
  glyphs
    .map((svg, i) => `<g transform="translate(${String(24 + i * (SIZE + GAP))} 14)">${svg}</g>`)
    .join('') +
  `</svg>`;

console.log(
  'build-banner: ' +
    [
      await render(card, WIDTH, HEIGHT, 'banner.png'),
      await render(strip, stripWidth, STRIP_H, 'strip.png'),
    ].join(', ') +
    `, ${String(glyphs.length)} glyphs`,
);
