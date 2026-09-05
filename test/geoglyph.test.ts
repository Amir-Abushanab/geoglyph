import assert from 'node:assert/strict';
import test from 'node:test';
import { CODES, has, load, toSvg } from '../dist/index.js';
import { loadFlag } from '../dist/flags.js';
import { loadFlagSvg } from '../dist/flags-svg.js';
import { clipPathFor } from '../dist/svg.js';

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
  assert.doesNotMatch(svg, /<clipPath|<image|clip-path/);
});

test('a flag is clipped to the outline and stretched to its box', async () => {
  const shape = await load('CL');
  assert.ok(shape !== null);
  const svg = toSvg(shape, { flag: 'https://example.test/cl.png', size: 24, title: 'Chile' });
  assert.match(svg, /<image class="geoglyph-flag" style="clip-path:path\(&#x27;M/);
  assert.match(svg, /preserveAspectRatio="none"/);
  assert.match(svg, /width="24px" height="24px"/);
  assert.match(svg, /role="img" aria-label="Chile"/);
});

test('a flag replaces the silhouette, and backdrop puts it back', async () => {
  const shape = await load('AD');
  assert.ok(shape !== null);
  /* Painted under a flag the silhouette is nothing but a rim: at a boundary pixel with
     coverage `a` the fill contributes `a(1-a)`, a quarter of it at the halfway point, all
     the way round the glyph. Measured on Andorra at 300px that is ~200 pixels of fill
     nobody asked for, so it is off unless something actually needs to be underneath. */
  assert.doesNotMatch(toSvg(shape, { flag: 'a.png' }), /geoglyph-shape/);
  assert.match(toSvg(shape, { flag: 'a.png', backdrop: true }), /geoglyph-shape/);
  // Without a flag there is nothing to rim against, so the silhouette is the whole glyph.
  assert.match(toSvg(shape), /geoglyph-shape/);
  const both = toSvg(shape, { flag: 'a.png', backdrop: true });
  assert.ok(both.indexOf('geoglyph-shape') < both.indexOf('geoglyph-flag'), 'flag paints last');
});

test('raw svg source is wrapped, an address is left alone', async () => {
  const shape = await load('PE');
  assert.ok(shape !== null);
  const inline = toSvg(shape, {
    flag: '<svg viewBox="0 0 4 3"><rect width="4" height="3"/></svg>',
  });
  assert.match(inline, /href="data:image\/svg\+xml;utf8,%3Csvg/);
  const linked = toSvg(shape, { flag: '/flags/pe.png' });
  assert.match(linked, /href="\/flags\/pe\.png"/);
});

test('the clip carries the outline instead of pointing at it', async () => {
  const br = await load('BR');
  assert.ok(br !== null);
  const svg = toSvg(br, { flag: 'a.png' });
  // Nothing to resolve, so nothing to dangle. A `url(#id)` clip is shared by every glyph
  // of a country, and goes invalid for all of them the moment the copy that declared it
  // stops being rendered — skipped offscreen, or unmounted while a twin survives. An
  // invalid clip is no clip, so the flag would draw as a rectangle over the country.
  assert.doesNotMatch(svg, /url\(#|<clipPath| id="/);
  assert.equal(clipPathFor(br), `path('${br.d}')`);
  assert.match(svg, /<image class="geoglyph-flag" style="clip-path:path\(&#x27;M/);
});

test('a quote in path data cannot break out of the css string', () => {
  const hostile = { d: "M0 0L1 1'),url(#x)/*", viewBox: '0 0 1 1' };
  assert.equal(clipPathFor(hostile), "path('M0 0L1 1\\'),url(#x)/*')");
  // Escaped twice over, because it sits in two grammars: a backslash for the CSS string,
  // an entity for the attribute holding it.
  assert.match(
    toSvg(hostile, { flag: 'a.png' }),
    /clip-path:path\(&#x27;M0 0L1 1\\&#x27;\),url\(#x\)/,
  );
});

test('markup that would break out of an attribute is escaped', async () => {
  const shape = await load('BR');
  assert.ok(shape !== null);
  const svg = toSvg(shape, { title: 'Brazil " <script>', className: 'x" onload="y' });
  assert.doesNotMatch(svg, /onload="y"/);
  assert.match(svg, /&quot;/);
});
