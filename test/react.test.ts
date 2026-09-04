import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Glyph } from '../dist/react.js';
import { clipIdFor, toSvg } from '../dist/svg.js';
import { load } from '../dist/index.js';
import { loadFlag } from '../dist/flags.js';
import { loadFlagSvg } from '../dist/flags-svg.js';

const shape = await load('BR');
assert.ok(shape !== null);
const flag = await loadFlag('BR');
assert.ok(flag !== null);

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Glyph, { shape, ...props } as never));

test('renders the outline alone by default', () => {
  const html = render({});
  assert.match(html, /^<svg viewBox="0 0 /);
  assert.match(html, /width="1em" height="1em"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /class="geoglyph-shape" fill="currentColor"/);
  assert.doesNotMatch(html, /clipPath|<image/);
});

test('renders the same markup the string renderer does', () => {
  const html = render({ flag, size: 24, title: 'Brazil' });
  const string = toSvg(shape, { flag, size: 24, title: 'Brazil', className: '' });
  // Same clip id from both, which is what makes them interchangeable across a hydration
  // boundary — one may render the shell and the other an island.
  const id = (markup: string) => /id="(geoglyph-[a-z0-9]+)"/.exec(markup)?.[1];
  assert.equal(id(html), id(string));
  assert.equal(id(html), clipIdFor(shape));
});

test('a flag is clipped, stretched, and drawn over the shape', () => {
  const html = render({ flag });
  assert.match(html, /<clipPath id="geoglyph-[a-z0-9]+">/);
  assert.match(html, /<image class="geoglyph-flag" clip-path="url\(#geoglyph-[a-z0-9]+\)"/);
  assert.match(html, /preserveAspectRatio="none"/);
  assert.match(html, /width="100%" height="100%"/);
  assert.ok(html.indexOf('geoglyph-shape') < html.indexOf('geoglyph-flag'), 'flag must paint last');
});

test('raw svg source is wrapped, an address is left alone', () => {
  assert.match(render({ flag: '<svg viewBox="0 0 4 3"/>' }), /href="data:image\/svg\+xml;utf8,%3Csvg/);
  assert.match(render({ flag: '/flags/br.png' }), /href="\/flags\/br\.png"/);
});

test('title makes it an image, absence makes it decoration', () => {
  assert.match(render({ title: 'Brazil' }), /role="img" aria-label="Brazil"/);
  assert.doesNotMatch(render({ title: 'Brazil' }), /aria-hidden/);
  assert.match(render({}), /aria-hidden="true"/);
});

test('everything else lands on the svg', () => {
  const html = render({
    className: 'mark',
    style: { opacity: 0.5 },
    'data-iso': 'BR',
    onClick: () => undefined,
  });
  assert.match(html, /class="mark"/);
  assert.match(html, /style="opacity:0.5"/);
  assert.match(html, /data-iso="BR"/);
  // A handler is not markup, and must not leak into it as one.
  assert.doesNotMatch(html, /onClick/i);
});

test('a caller can override what the component decides', () => {
  const html = render({ flag, clipId: 'mine', fill: '#c00', size: '2rem' });
  assert.match(html, /id="mine"/);
  assert.match(html, /clip-path="url\(#mine\)"/);
  assert.match(html, /fill="#c00"/);
  assert.match(html, /width="2rem" height="2rem"/);
});

test('it forwards a ref', () => {
  const ref = createRef<SVGSVGElement>();
  // Server rendering never attaches, but the prop must be accepted and not rendered.
  const html = renderToStaticMarkup(createElement(Glyph, { shape, ref } as never));
  assert.doesNotMatch(html, /ref=/);
});
