import type { Shape, SvgOptions } from './types.js';

/*
 * Both quote characters, not just the double one: the clip path travels in a `style`
 * attribute as `path('…')`, so an apostrophe is live in two grammars at once. Escaping it
 * is also what keeps this renderer byte-identical to React's, which escapes both.
 */
const escape = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');

/*
 * What a URL parser or an attribute would misread, and nothing else. `encodeURIComponent`
 * on the whole document made the vector tier a third larger — every space, slash and
 * equals sign three bytes — where this set costs under a tenth. Tabs and newlines because
 * a URL parser strips them outright, which would fuse two attributes into one; `%` because
 * it is the escape; `#` because it opens a fragment, and `?` a query; quotes, `&` and the
 * angle brackets for whoever puts the result in an attribute or a CSS `url()`, where each
 * is three bytes here against six as an entity; the rest are not URL code points.
 */
const unsafe = /[\t\n\r"%#&'()<>?[\\\]^`{|}]/g;

/**
 * Raw SVG source becomes a data URI; anything else is already an address. Percent-encoded
 * rather than base64, which is both smaller for XML and legible in devtools. Whitespace
 * ahead of the `<svg` is dropped: a document is allowed to open with an XML declaration
 * only if nothing at all comes before it.
 */
export const flagHref = (flag: string): string => {
  const source = flag.trimStart();
  return source.startsWith('<')
    ? `data:image/svg+xml;utf8,${source.replace(unsafe, encodeURIComponent)}`
    : flag;
};

/**
 * The `clip-path` that pours a flag into an outline — `path('…')`, ready to drop into a
 * style attribute, for anyone assembling the markup themselves.
 *
 * The outline inline, rather than a `url(#…)` pointing at a `<clipPath>` element, and that
 * is load-bearing rather than tidy. A referenced clip needs an id; an id derived from the
 * outline is the same for every glyph of a country, which reads as a feature — one
 * declaration, shared — right up until the copy that owns it stops being rendered. Skipped
 * offscreen under `content-visibility: auto`, or unmounted while a twin elsewhere on the
 * page survives, and every other copy is left pointing at nothing. Per CSS Masking an
 * invalid clip is *no* clip, so the failure is not a missing flag but a rectangular one,
 * painted over the country it was meant to be poured into.
 *
 * Inline, every glyph carries its own and no glyph depends on another being alive. It
 * costs nothing: the `<clipPath>` element held a second copy of the same path data.
 */
export const clipPathFor = (shape: Shape): string =>
  `path('${shape.d.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}')`;

/**
 * One country as an `<svg>` string.
 *
 * A string rather than a component, because a leaf node with no state has no business
 * picking a framework for you: this works in Astro, React's `dangerouslySetInnerHTML`,
 * a template literal, a Hugo partial, or `innerHTML`.
 *
 * The markup is a pure function of the shape and the options — no ids, no counters, no
 * document-wide anything — so a server render and a client one agree by construction.
 *
 * A flag replaces the silhouette rather than covering it, because the two cannot share an
 * edge without the lower one showing through it — see `backdrop`, which paints it anyway
 * for the cases that need something underneath:
 *
 *     .geoglyph-flag { opacity: 0; transition: opacity 150ms }
 *     a:hover .geoglyph-flag { opacity: 1 }
 */
export function toSvg(shape: Shape, options: SvgOptions = {}): string {
  const { size = '1em', fill = 'currentColor', className, flag, title, backdrop = false } = options;
  const length = typeof size === 'number' ? `${String(size)}px` : size;

  const label =
    title === undefined ? ' aria-hidden="true"' : ` role="img" aria-label="${escape(title)}"`;

  const parts: string[] = [];
  /* Under a flag the silhouette is a hairline of `fill` around the glyph and nothing else,
     since the flag covers everything it would have drawn. Only `backdrop` asks for it. */
  if (flag === undefined || backdrop) {
    parts.push(`<path class="geoglyph-shape" fill="${escape(fill)}" d="${escape(shape.d)}"/>`);
  }
  if (flag !== undefined) {
    parts.push(
      `<image class="geoglyph-flag" style="clip-path:${escape(clipPathFor(shape))}"` +
        ` href="${escape(flagHref(flag))}" x="0" y="0" width="100%" height="100%"` +
        ` preserveAspectRatio="none"/>`,
    );
  }

  return (
    `<svg class="${escape(className ?? 'geoglyph')}" viewBox="${escape(shape.viewBox)}"` +
    ` width="${escape(length)}" height="${escape(length)}" focusable="false"${label}>` +
    parts.join('') +
    `</svg>`
  );
}
