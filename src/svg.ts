import type { Shape, SvgOptions } from './types.js';

/**
 * FNV-1a, for an id that depends only on what is being drawn. A random id would break
 * server rendering — the markup has to match what the client would produce — and a
 * counter would break it differently, by depending on how many glyphs came before.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Raw SVG source becomes a data URI; anything else is already an address. Percent-encoded
 * rather than base64, which is both smaller for XML and legible in devtools.
 */
const asHref = (flag: string) =>
  flag.trimStart().startsWith('<')
    ? `data:image/svg+xml;utf8,${encodeURIComponent(flag)}`
    : flag;

/**
 * One country as an `<svg>` string.
 *
 * A string rather than a component, because a leaf node with no state has no business
 * picking a framework for you: this works in Astro, React's `dangerouslySetInnerHTML`,
 * a template literal, a Hugo partial, or `innerHTML`.
 *
 * The flag is drawn over the silhouette rather than instead of it, so there is something
 * to see while the image is still arriving — and so that fading it in and out with CSS
 * lands on the shape rather than on nothing:
 *
 *     .geoglyph-flag { opacity: 0; transition: opacity 150ms }
 *     a:hover .geoglyph-flag { opacity: 1 }
 */
export function toSvg(shape: Shape, options: SvgOptions = {}): string {
  const { size = '1em', fill = 'currentColor', className, flag, title } = options;
  const length = typeof size === 'number' ? `${String(size)}px` : size;
  const clip = options.clipId ?? `geoglyph-${fingerprint(shape.d)}`;

  const label =
    title === undefined
      ? ' aria-hidden="true"'
      : ` role="img" aria-label="${escape(title)}"`;

  const parts = [
    `<path class="geoglyph-shape" fill="${escape(fill)}" d="${escape(shape.d)}"/>`,
  ];
  if (flag !== undefined) {
    parts.unshift(`<clipPath id="${escape(clip)}"><path d="${escape(shape.d)}"/></clipPath>`);
    parts.push(
      `<image class="geoglyph-flag" clip-path="url(#${escape(clip)})"` +
        ` href="${escape(asHref(flag))}" x="0" y="0" width="100%" height="100%"` +
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
