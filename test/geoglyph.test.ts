import assert from 'node:assert/strict';
import test from 'node:test';
import { CODES, has, load, toSvg } from '../dist/index.js';
import { loadFlag } from '../dist/flags.js';
import { loadFlagSvg } from '../dist/flags-svg.js';

const subpaths = (d: string) => d.split('M').length - 1;
function box(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [x = NaN, y = NaN, w = NaN, h = NaN] = viewBox.split(' ').map(Number);
  return { x, y, w, h };
}

test('every code loads a shape framed at its own origin', async () => {
  assert.ok(CODES.length > 200, `only ${String(CODES.length)} codes`);
  for (const code of CODES) {
    const shape = await load(code);
    assert.ok(shape !== null, `${code} has no shape`);
    const { x, y, w, h } = box(shape.viewBox);
    assert.equal(x, 0);
    assert.equal(y, 0);
    assert.ok(w > 0 && h > 0, `${code} is ${shape.viewBox}`);
    assert.ok(shape.d.startsWith('M'), `${code} path starts ${shape.d.slice(0, 8)}`);
  }
});

test('lookup is case-insensitive and honest about misses', async () => {
  assert.equal(has('br'), true);
  assert.equal(has('BR'), true);
  assert.equal(has('XQ'), false);
  assert.equal(await load('XQ'), null);
  assert.equal(await loadFlag('XQ'), null);
});

/*
 * The crop is the part of this package that can silently go wrong: it is a heuristic, and
 * when it fails it fails by drawing a recognisable country as a speck beside an island.
 * These are the four cases that pin the two directions it can fail in.
 */
test('the crop keeps what belongs and drops what is merely owned', async () => {
  const us = await load('US');
  assert.ok(us !== null);
  // Alaska and Hawaii would put this past 100 degrees; the lower 48 are 58 across.
  assert.ok(box(us.viewBox).w < 70, `US is ${us.viewBox} — Alaska is back`);

  const fr = await load('FR');
  assert.ok(fr !== null);
  // Réunion is 120 degrees east of Paris. Corsica, at under two, must stay.
  assert.ok(box(fr.viewBox).w < 20, `FR is ${fr.viewBox} — an overseas department is back`);
  assert.ok(subpaths(fr.d) >= 2, 'FR lost Corsica');

  const nz = await load('NZ');
  assert.ok(nz !== null);
  assert.ok(subpaths(nz.d) >= 2, 'NZ lost an island — area thresholds do this');

  const au = await load('AU');
  assert.ok(au !== null);
  assert.ok(subpaths(au.d) >= 2, 'AU lost Tasmania');
});

test('the sheet carries what a coarser one drops', async () => {
  for (const code of ['DM', 'GF', 'GD', 'MT', 'SG']) {
    assert.ok(await load(code), `${code} missing — the 110m sheet rounds it away`);
  }
});

test('every glyph has both tiers of flag', async () => {
  for (const code of CODES) {
    const raster = await loadFlag(code);
    const vector = await loadFlagSvg(code);
    assert.ok(raster?.startsWith('data:image/png;base64,'), `${code} raster`);
    assert.ok(vector?.startsWith('<svg'), `${code} vector`);
  }
});

test('toSvg draws the outline alone by default', async () => {
  const shape = await load('BR');
  assert.ok(shape !== null);
  const svg = toSvg(shape);
  assert.match(svg, /<svg class="geoglyph" viewBox="0 0 /);
  assert.match(svg, /width="1em" height="1em"/);
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /class="geoglyph-shape" fill="currentColor"/);
  assert.doesNotMatch(svg, /<clipPath|<image/);
});

test('a flag is clipped to the outline and stretched to its box', async () => {
  const shape = await load('CL');
  assert.ok(shape !== null);
  const svg = toSvg(shape, { flag: 'https://example.test/cl.png', size: 24, title: 'Chile' });
  assert.match(svg, /<clipPath id="geoglyph-[a-z0-9]+">/);
  assert.match(svg, /<image class="geoglyph-flag" clip-path="url\(#geoglyph-[a-z0-9]+\)"/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.match(svg, /width="24px" height="24px"/);
  assert.match(svg, /role="img" aria-label="Chile"/);
  // The shape stays under the flag, so there is something to see while it loads.
  assert.match(svg, /geoglyph-shape/);
});

test('raw svg source is wrapped, an address is left alone', async () => {
  const shape = await load('PE');
  assert.ok(shape !== null);
  const inline = toSvg(shape, { flag: '<svg viewBox="0 0 4 3"><rect width="4" height="3"/></svg>' });
  assert.match(inline, /href="data:image\/svg\+xml;utf8,%3Csvg/);
  const linked = toSvg(shape, { flag: '/flags/pe.png' });
  assert.match(linked, /href="\/flags\/pe\.png"/);
});

test('the clip id depends on the shape and nothing else', async () => {
  const br = await load('BR');
  const pe = await load('PE');
  assert.ok(br !== null && pe !== null);
  const id = (svg: string) => /id="(geoglyph-[a-z0-9]+)"/.exec(svg)?.[1];
  // Same country twice is the same id on purpose: a shared clip clips both correctly,
  // and a counter or a random suffix would make server and client disagree.
  assert.equal(id(toSvg(br, { flag: 'a.png' })), id(toSvg(br, { flag: 'b.png' })));
  assert.notEqual(id(toSvg(br, { flag: 'a.png' })), id(toSvg(pe, { flag: 'a.png' })));
});

test('markup that would break out of an attribute is escaped', async () => {
  const shape = await load('BR');
  assert.ok(shape !== null);
  const svg = toSvg(shape, { title: 'Brazil " <script>', className: 'x" onload="y' });
  assert.doesNotMatch(svg, /onload="y"/);
  assert.match(svg, /&quot;/);
});
