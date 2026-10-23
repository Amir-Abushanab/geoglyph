import assert from 'node:assert/strict';
import test from 'node:test';
import { CODES, has, load, toSvg } from '../dist/index.js';
import { loadFlag } from '../dist/flags.js';
import { loadFlagSvg } from '../dist/flags-svg.js';
import { clipPathFor, flagHref } from '../dist/svg.js';
/* Through the package's own name, the way a consumer reaches them: these are the wildcard
   entries of the exports map, which attw cannot check and nothing else here imports. */
import brShape from 'geoglyph/shape/br';
import brFlag from 'geoglyph/flag-px/br';
import brFlagSvg from 'geoglyph/flag/br';
import euShape from 'geoglyph/shape/eu';
import euFlag from 'geoglyph/flag-px/eu';
import euFlagSvg from 'geoglyph/flag/eu';

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

/*
 * `EU` is the one code with no feature of its own in Natural Earth: its members, each
 * cropped as its own glyph is, dissolved into one outline. It can fail the crop's two ways
 * at the scale of a continent — an outermost region dragged back in, or a member lost — and
 * one of its own: the members laid side by side instead of dissolved.
 */
test('the EU is its members in one outline, cropped like each of them', async () => {
  assert.ok(CODES.includes('EU'));
  assert.equal(has('eu'), true);
  const eu = await load('eu');
  assert.ok(eu !== null);
  assert.deepEqual(eu, euShape);
  const { w, h } = box(eu.viewBox);
  // Ireland to Cyprus is 45 degrees and Crete to Lapland 35. The Canaries or the Azores
  // would put it past 55 across, and Réunion past 100.
  assert.ok(w < 50 && h < 42, `EU is ${eu.viewBox} — an outermost region is back`);
  assert.ok(w > 45, `EU is ${eu.viewBox} — Ireland or Cyprus is gone`);
  // Laid side by side, every member is a subpath at least. Dissolved, the mainland is one.
  assert.ok(subpaths(eu.d) < 27, `EU is ${String(subpaths(eu.d))} outlines — not dissolved`);
  assert.ok(subpaths(eu.d) >= 10, 'EU lost its islands');
});

/* The blocs after it are drawn the same way, and fail the same ways: a member lost, or one
   dragged in from too far. Their codes run past two letters, which no country's does. */
test('ASEAN is Southeast Asia from Myanmar to Papua', async () => {
  assert.ok(CODES.includes('ASEAN'));
  assert.equal(has('asean'), true);
  const asean = await load('asean');
  assert.ok(asean !== null);
  const { w, h } = box(asean.viewBox);
  // Myanmar's coast to Papua's border is 49 degrees across, and Kachin to Rote 40 down.
  assert.ok(w > 50 && w < 56, `ASEAN is ${asean.viewBox} — Myanmar or Papua is gone`);
  assert.ok(h > 40 && h < 46, `ASEAN is ${asean.viewBox} — Kachin or the Lesser Sundas is gone`);
  assert.ok(subpaths(asean.d) >= 20, 'ASEAN lost its islands');
});

test('the EAC is East Africa from the Congo to the Horn', async () => {
  assert.ok(CODES.includes('EAC'));
  const eac = await load('eac');
  assert.ok(eac !== null);
  const { w, h } = box(eac.viewBox);
  // The Congo's Atlantic coast to Somalia's eastern tip is 39 degrees, South Sudan's north
  // to Katanga 26.
  assert.ok(w > 40 && w < 45, `EAC is ${eac.viewBox} — the DR Congo or Somalia is gone`);
  assert.ok(h > 26 && h < 32, `EAC is ${eac.viewBox} — South Sudan or the south is gone`);
});

/* A member out of the crop's reach of every other is a member all the same. */
test('the Arab League runs from Mauritania to Oman, the Comoros in', async () => {
  assert.ok(CODES.includes('ARAB'));
  const arab = await load('arab');
  assert.ok(arab !== null);
  const { w, h } = box(arab.viewBox);
  // Mauritania's coast to Oman's is 77 degrees across.
  assert.ok(w > 80 && w < 86, `ARAB is ${arab.viewBox} — Mauritania or Oman is gone`);
  // Syria to Somalia is 39 degrees down, and to the Comoros 50.
  assert.ok(h > 52 && h < 58, `ARAB is ${arab.viewBox} — the Comoros is gone`);
});

/*
 * The Pacific Community fails in two ways of its own. Cut at the date line, as the plain
 * projection cuts it, it spans the whole world with nothing in the middle; and at its scale
 * most of its members are specks, which it keeps, as dots, rather than drop.
 */
test('the Pacific Community is one ocean, every member in it', async () => {
  assert.ok(CODES.includes('PC'));
  const pc = await load('pc');
  assert.ok(pc !== null);
  const { w } = box(pc.viewBox);
  // Western Australia to Pitcairn is 119 degrees across the date line, and 241 round the
  // other way.
  assert.ok(w < 135, `PC is ${pc.viewBox} — cut at the date line`);
  assert.ok(w > 120, `PC is ${pc.viewBox} — Pitcairn or Western Australia is gone`);
  // Twenty-four members drawn, each at least one outline.
  assert.ok(subpaths(pc.d) >= 24, `PC is ${String(subpaths(pc.d))} outlines — a member is gone`);
});

/* The world is one shape, not two hundred laid side by side, and Antarctica, left in, is
   the largest ring on the sheet and the only one the crop keeps. */
test('UN is the whole world but Antarctica, in one outline', async () => {
  assert.ok(CODES.includes('UN'));
  const un = await load('un');
  assert.ok(un !== null);
  const { w, h } = box(un.viewBox);
  // A whole turn across, and Greenland to Tierra del Fuego 139 degrees down, each with 29
  // of air. Antarctica alone would be 56 down, and the world with it 209.
  assert.ok(w > 380, `UN is ${un.viewBox} — a continent is gone`);
  assert.ok(h > 160 && h < 180, `UN is ${un.viewBox} — Antarctica is back`);
  assert.ok(subpaths(un.d) < 100, `UN is ${String(subpaths(un.d))} outlines — not dissolved`);
});

test('the sheet carries what a coarser one drops', async () => {
  for (const code of ['DM', 'GF', 'GD', 'MT', 'SG']) {
    assert.ok(await load(code), `${code} missing — the 110m sheet rounds it away`);
  }
});

/*
 * The three the crop once kept nothing of. Fiji, cut in two by the date line, is every
 * island a speck beside a span of 360 degrees unless it is drawn the other way round; Kiribati
 * and Micronesia are every island a speck beside their chains, so each is its largest.
 */
test('the Pacific countries the crop kept nothing of are there', async () => {
  const fj = await load('FJ');
  assert.ok(fj !== null, 'FJ missing — the date line cut it in two');
  // Viti Levu to Vanua Levu's tip at the date line is three degrees.
  assert.ok(box(fj.viewBox).w < 5, `FJ is ${fj.viewBox} — drawn round the world`);
  assert.ok(subpaths(fj.d) >= 2, 'FJ lost Vanua Levu');
  for (const code of ['KI', 'FM']) {
    const shape = await load(code);
    assert.ok(shape !== null, `${code} missing — every island a speck`);
    // Kiritimati and Pohnpei are each under half a degree across.
    assert.ok(box(shape.viewBox).w < 0.6, `${code} is ${shape.viewBox} — more than one island`);
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

test('the exports map reaches every static module', async () => {
  assert.deepEqual(brShape, await load('BR'));
  assert.equal(brFlag, await loadFlag('BR'));
  assert.equal(brFlagSvg, await loadFlagSvg('BR'));
  assert.equal(euFlag, await loadFlag('EU'));
  assert.equal(euFlagSvg, await loadFlagSvg('eu'));
  assert.match(euFlagSvg, /id="flag-icons-eu"/);
});

test('an inline flag is encoded where a URL would misread it, and nowhere else', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n\t<path fill="#c00" d="M0 0h4v3H0z"/>\n</svg>';
  const prefix = 'data:image/svg+xml;utf8,';
  const href = flagHref(`\n  ${svg}`);
  assert.ok(href.startsWith(prefix));
  const body = href.slice(prefix.length);
  // A URL parser drops tabs and newlines outright, which would fuse two attributes into
  // one, and reads `#` as a fragment. Spaces, slashes and equals signs it leaves alone, so
  // they stay legible and cost one byte instead of three.
  assert.doesNotMatch(body, /[\t\n\r"#<>]/);
  assert.match(
    body,
    /^%3Csvg xmlns=%22http:\/\/www\.w3\.org\/2000\/svg%22 viewBox=%220 0 4 3%22%3E%0A%09/,
  );
  assert.match(body, /fill=%22%23c00%22/);
  assert.equal(decodeURIComponent(body), svg);
  assert.ok(body.length < encodeURIComponent(svg).length, 'no smaller than encoding everything');
  // An address, or a data URI already, is left exactly as given.
  assert.equal(flagHref('/flags/br.png'), '/flags/br.png');
  assert.equal(flagHref('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});
