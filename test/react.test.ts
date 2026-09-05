import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Glyph } from '../dist/react.js';
import { clipPathFor, toSvg } from '../dist/svg.js';
import { load } from '../dist/index.js';
import { loadFlag } from '../dist/flags.js';

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
  assert.doesNotMatch(html, /clipPath|clip-path|<image/);
});

const clip = (markup: string) => /style="([^"]+)"/.exec(markup)?.[1];

test('renders the same markup the string renderer does', () => {
  const html = render({ flag, size: 24, title: 'Brazil' });
  const string = toSvg(shape, { flag, size: 24, title: 'Brazil', className: '' });
  // What makes them interchangeable across a hydration boundary — one may render the
  // shell and the other an island. Both are a pure function of the shape, so there is no
  // id, counter or render order for the two to disagree about.
  assert.equal(clip(html), clip(string));
  assert.ok(clip(html)?.startsWith('clip-path:path(&#x27;M'));
  // The same value both renderers escaped, unescaped again.
  assert.equal(clip(html)?.replaceAll('&#x27;', "'"), `clip-path:${clipPathFor(shape)}`);
});

test('a flag is clipped, stretched, and drawn over the shape', () => {
  const html = render({ flag });
  assert.match(html, /<image class="geoglyph-flag" style="clip-path:path\(&#x27;M/);
  assert.doesNotMatch(html, /url\(#|<clipPath/);
  assert.match(html, /preserveAspectRatio="none"/);
  assert.match(html, /width="100%" height="100%"/);
  assert.doesNotMatch(html, /geoglyph-shape/);
});

test('backdrop is the only way to get the silhouette under a flag', () => {
  const html = render({ flag, backdrop: true });
  assert.match(html, /geoglyph-shape/);
  assert.ok(html.indexOf('geoglyph-shape') < html.indexOf('geoglyph-flag'), 'flag must paint last');
  // The two renderers agree about the option, which is what a hydration boundary needs.
  // Not about every byte: React writes `<path></path>` where the string renderer writes
  // `<path/>`, and always has.
  assert.doesNotMatch(render({ flag }), /geoglyph-shape/);
  assert.match(toSvg(shape, { flag, backdrop: true }), /geoglyph-shape/);
});

test('raw svg source is wrapped, an address is left alone', () => {
  assert.match(
    render({ flag: '<svg viewBox="0 0 4 3"/>' }),
    /href="data:image\/svg\+xml;utf8,%3Csvg/,
  );
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
  const html = render({ flag, backdrop: true, fill: '#c00', size: '2rem' });
  assert.match(html, /fill="#c00"/);
  assert.match(html, /width="2rem" height="2rem"/);
});

test('it forwards a ref', () => {
  const ref = createRef<SVGSVGElement>();
  // Server rendering never attaches, but the prop must be accepted and not rendered.
  const html = renderToStaticMarkup(createElement(Glyph, { shape, ref } as never));
  assert.doesNotMatch(html, /ref=/);
});
