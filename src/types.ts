/** A country reduced to a mark: one path, and the box it was framed in. */
export interface Shape {
  /**
   * The outline, as SVG path data. Cropped to the landmass the country is normally
   * pictured as — see the README on why that crop is by distance and not by area — and
   * moved to its own origin, so the viewBox starts at `0 0` and a flag laid over it can
   * be positioned in percentages.
   */
  readonly d: string;
  /** Always `0 0 w h`, in degrees. Its aspect ratio is the country's. */
  readonly viewBox: string;
}

export interface SvgOptions {
  /** Any CSS length. Defaults to `1em`, which is what makes it a glyph and not a picture. */
  readonly size?: string | number;
  /** Painted on the shape. Defaults to `currentColor`, so it inherits like text. */
  readonly fill?: string;
  /** Goes on the `<svg>`. The parts inside carry `geoglyph-shape` and `geoglyph-flag`. */
  readonly className?: string;
  /**
   * A flag to pour into the outline: a URL, a data URI, or raw `<svg>` source, which is
   * wrapped into a data URI for you. Omit it and only the silhouette is drawn.
   *
   * It is stretched to the shape's box rather than fitted inside it, which is the only
   * way a flag survives being poured into a country: cropped to the outline of Peru a
   * flag is a white stripe, where squeezed into it it still reads red-white-red.
   */
  readonly flag?: string;
  /**
   * Paint the silhouette underneath the flag. Off by default, and that default is the
   * whole of what this option is for.
   *
   * A fill and a clipped image with the same edge do not add up to one edge. At a
   * boundary pixel with coverage `a` the composite is `flag·a + fill·a(1-a) + page·(1-a)²`
   * — and that middle term peaks at a quarter of the fill colour, so the silhouette shows
   * as a hairline around the entire glyph. It is there in both tiers, at every size, in
   * every engine, and no arrangement of groups or clips removes it: only not painting the
   * fill does.
   *
   * Turn it on when something has to be under the flag. Two cases: a `flag` that is a URL
   * rather than a data URI, so there is a wait to fill; and the hover fade in the README,
   * which wants the flag to fade onto the shape rather than onto the page.
   */
  readonly backdrop?: boolean;
  /** An accessible name. Given, the svg becomes `role="img"`; omitted, it is hidden. */
  readonly title?: string;
}
