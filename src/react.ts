import { createElement, forwardRef, type ReactElement, type SVGProps } from 'react';
import { clipIdFor, flagHref } from './svg.js';
import type { Shape } from './types.js';

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'ref'> {
  /** The outline, from `geoglyph/shape/<iso>` or `load()`. */
  shape: Shape;
  /**
   * A flag to pour into it: a URL, a data URI, or raw `<svg>` source, which is wrapped
   * into a data URI for you. Omit it and only the silhouette is drawn.
   */
  flag?: string | undefined;
  /** Any CSS length, applied to both axes. Defaults to `1em`. */
  size?: string | number | undefined;
  /** Painted on the shape. Defaults to `currentColor`. */
  fill?: string | undefined;
  /** An accessible name. Given, this is `role="img"`; omitted, it is `aria-hidden`. */
  title?: string | undefined;
  /** Overrides the clip path id, which otherwise comes from the outline itself. */
  clipId?: string | undefined;
}

/**
 * One country as an element.
 *
 * Deliberately dumb: it takes a shape rather than a country code, holds no state, runs no
 * effect and fetches nothing. A component that loaded its own data would put a request
 * waterfall behind every flag on the page and a loading state in every consumer. Pass it
 * a static import when you know the country, and the result of `load()` when you do not —
 * through `use()`, a query cache, or whatever else already owns your loading states.
 *
 * Everything else is forwarded, so `className`, `style`, `onClick`, `data-*` and a `ref`
 * all land on the `<svg>`.
 *
 *     import shape from 'geoglyph/shape/br';
 *     import flag from 'geoglyph/flag-px/br';
 *     <Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
 *
 * The flag is drawn over the silhouette rather than instead of it, so there is something
 * to see while the image arrives and a hover fades onto the shape rather than onto
 * nothing. Both parts carry stable class names to style against:
 *
 *     .geoglyph-flag { opacity: 0; transition: opacity 150ms }
 *     a:hover .geoglyph-flag { opacity: 1 }
 */
export const Glyph = forwardRef<SVGSVGElement, GlyphProps>(function Glyph(props, ref) {
  const { shape, flag, size = '1em', fill = 'currentColor', title, clipId, ...rest } = props;
  const length = typeof size === 'number' ? `${String(size)}px` : size;
  const clip = clipId ?? clipIdFor(shape);

  /* Keyed children rather than a fragment: React wants keys for an array, and these are
     an array so that the flag can be left out without a hole in the tree. */
  const parts: ReactElement[] = [
    createElement('path', { key: 'shape', className: 'geoglyph-shape', fill, d: shape.d }),
  ];
  if (flag !== undefined) {
    parts.unshift(
      createElement(
        'clipPath',
        { key: 'clip', id: clip },
        createElement('path', { d: shape.d }),
      ),
    );
    parts.push(
      createElement('image', {
        key: 'flag',
        className: 'geoglyph-flag',
        clipPath: `url(#${clip})`,
        href: flagHref(flag),
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        /* Stretched to the shape's box, not fitted inside it: a flag cropped to the
           outline of Peru is a white stripe, where squeezed into it it still reads
           red-white-red. */
        preserveAspectRatio: 'none',
      }),
    );
  }

  return createElement(
    'svg',
    {
      ...rest,
      ref,
      viewBox: shape.viewBox,
      width: length,
      height: length,
      focusable: 'false',
      ...(title === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': title }),
    },
    parts,
  );
});
