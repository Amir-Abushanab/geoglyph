# geoglyph

## 0.1.1

### Patch Changes

- 80a95f0: Point the README banner at an absolute URL and declare the repository, so the strip
  renders on npm instead of resolving against npmjs.com and 404ing.

## 0.1.0

### Minor Changes

- c53929b: First release. Every country as a mark the size of a letter: an outline cropped to the
  landmass it is recognised by, framed on its own, and its flag in two tiers to pour inside.
- e789fe7: Clip the flag with an inline `clip-path: path('…')` instead of a `<clipPath>` element
  referenced by id. The id was a fingerprint of the outline, so every glyph of a country
  shared one declaration, and all of them lost their clip the moment the copy that declared
  it stopped being rendered: skipped offscreen by `content-visibility`, or unmounted while a
  twin survived. An invalid clip is no clip, so the flag drew as a rectangle over the
  country rather than inside it.

  The markup is now a pure function of the shape and the options. `clipIdFor` is replaced by
  `clipPathFor`, and the `clipId` option is gone from both `toSvg` and `<Glyph>`.

- e789fe7: Ship `llms.txt`, a flat API reference for coding agents. It carries the entry points,
  `toSvg` options, `Glyph` props, working examples, the flag tiers and all 242 codes, plus
  the mistakes that are easy to make against this package: subpath imports are lowercase
  while `load` and `has` are not, `loadFlag` lives on `geoglyph/flags` rather than
  `geoglyph`, `flag` is a string, and a CSS hover fade needs `backdrop: true` to land on the
  shape.

  It is in the tarball and at the root of the playground site, so it is reachable from
  `node_modules` without the network. `pnpm llms` regenerates it from `package.json`, the
  type definitions and `CODES`; `pnpm check` fails if it is stale or if `SvgOptions` gained
  an option it does not document.

- e789fe7: The sheet can be cut to a point of view. Natural Earth carries 33 per-country columns
  saying who holds each contested area, and `GEOGLYPH_POV` picks one:

  ```sh
  GEOGLYPH_POV=UA pnpm vendor    # Crimea in Ukraine, no Kosovo
  GEOGLYPH_POV=RU pnpm vendor    # Crimea in Russia, Kosovo in Serbia, Taiwan in China
  ```

  Reassigned ground joins the country that viewpoint gives it to. An entity it does not
  recognise loses its glyph, its code and both its flags, so `RU` ships 240 countries and
  `MA` 239. A viewpoint also attributes ground that has no ISO code of its own, which is why
  Crimea is in nobody's outline until you choose one. The build prints every reassignment,
  since the upstream columns carry the occasional mistake.

  Leaving it unset is unchanged in every byte, and uses Natural Earth's default assignment.

- e789fe7: A flag now replaces the silhouette instead of being drawn over it. `backdrop` opts the
  silhouette back in.

  A fill and a clipped image with the same edge do not add up to one edge: at a boundary
  pixel with coverage `a` the fill contributes `a(1-a)`, a quarter of it at the halfway
  point, so the silhouette showed as a hairline around every flagged glyph, in both tiers,
  at every size, in every engine. On Andorra at 300px that was about 200 pixels of it.
  Clipping a group instead, or isolating one, measures identical; only not painting the fill
  removes it.

  Pass `backdrop: true` for the two cases that want something underneath: a `flag` given as a
  URL rather than a data URI, and a CSS hover fade, which needs the flag to fade onto the
  shape rather than onto the page.

### Patch Changes

- An inline SVG `flag` is percent-encoded only where a URL parser or an attribute would
  misread it — tabs, newlines, `%`, `#`, `?`, quotes, `&`, angle brackets and the handful of
  characters that are not URL code points — rather than everywhere `encodeURIComponent`
  reaches. Spaces, slashes and equals signs stay as they are, so the data URI for a vector
  flag is under a tenth larger than its source instead of a third: Serbia goes from 200 KB
  to 179 KB in the DOM. Whitespace ahead of the `<svg` is dropped too, so a source that opens
  with an XML declaration after a newline still parses.
- Declare `main` and `types` beside `exports`, so TypeScript's legacy `node10` resolution —
  what a `"moduleResolution": "node"` tsconfig still means — finds the root entry point
  instead of reporting no declarations. Subpaths still need `bundler`, `node16` or
  `nodenext`, which read `exports`.
