# geoglyph

## 0.4.0

### Minor Changes

- e112587: Add `REGIONS`, the codes that are not countries, beside `CODES`. `CODES` stays countries
  only, so a country picker built from it never shows a region; it changes only by gaining
  `FJ`, `KI` and `FM` below. A region loads like any country: `load`, `has`, `loadFlag`,
  `loadFlagSvg` and the `shape/`, `flag/` and `flag-px/` subpaths all take one, and each has
  its flag from flag-icons in both tiers.

  `REGIONS` is `EU` (above) and five more, the blocs drawn like it, as their members each
  cropped as its own glyph is and dissolved into one outline:

  - `ASEAN`, the Association of Southeast Asian Nations: its 11 member states, Timor-Leste
    included since October 2025.
  - `EAC`, the East African Community: its 8 partner states, Somalia and the DR Congo
    included. Somalia is what Natural Earth files under `SO`, so it is drawn without
    Somaliland, as the `SO` glyph is.
  - `ARAB`, the League of Arab States: its 22 members, Syria included. Morocco is drawn
    without Western Sahara and Somalia without Somaliland, as their own glyphs are, and
    Palestine as its own glyph is. The Comoros stays though it is far from every other member.
  - `PC`, the Pacific Community, standing in for Oceania: Australia, New Zealand and the 22
    Pacific island countries and territories among its 27 members. France, the United Kingdom
    and the United States are members too but are not drawn, or the Pacific would be a speck
    between their mainlands. It is drawn with the date line in the middle, and its members too
    small to see at that scale, Tuvalu to Pitcairn, are dots.

  And `UN`, the world, filled with the UN flag: every piece of land in one outline, the ground
  no country's code holds included, nothing cropped from it, and Antarctica left out as the UN
  emblem leaves it out.

  Add `FJ`, `KI` and `FM`, Fiji, Kiribati and Micronesia, to `CODES`: they had no glyph, as
  the crop kept nothing of them. Fiji is drawn across the date line, which cuts it in two, and
  Kiribati and Micronesia, whose every island is a speck beside the span of their chains, as
  their largest island, Kiritimati and Pohnpei. Every other country is unchanged.

- e112587: Add `EU`, the European Union, as a region: reserved for the Union by ISO 3166 and drawn by
  flag-icons. Its shape is the 27 member states, each cropped as its own glyph is (France
  without its overseas regions, Portugal without the Azores and Madeira, Spain without the
  Canaries, Åland with Finland), dissolved into one outline so no frontier between them is
  drawn. Switzerland stays a hole, and every member stays in, Malta included. Its flag is
  flag-icons' `eu.svg` in both tiers.

## 0.3.1

### Patch Changes

- 4bb93ee: Trim the README to installing, using and the API, with a few notes on how the shapes are drawn.

## 0.3.0

### Minor Changes

- 45710d1: Add `toBlocks(shape, { cells })`: the outline snapped to square cells, `cells` along its longer
  side (default 10). It returns a `Shape`, so `toSvg`, `Glyph` and flags take it unchanged. On
  the root and in its own entry point, `geoglyph/blocks`, which reaches no registry. The
  playground has a Blocks control.

## 0.2.0

### Minor Changes

- 8bd4a78: Draw `IL` and `PS` as one outline: Israel, the West Bank and Gaza laid together as a single
  landmass, the whole territory between the river and the sea, filed under both codes and
  poured full of the Palestinian flag. Natural Earth carries that ground as three features
  and so made three marks out of it — a country with a bite out of its middle, a sliver, and
  a speck the crop dropped. The table is `SHAPE_FROM` in `scripts/build-shapes.mjs`, the
  counterpart to the flag substitution already in `FLAG_FROM`, and the README says what both
  are doing.

  A shape unioned out of several rings is also simplified at half a grid cell rather than
  1.2, because two copies of one shared border simplified independently drift apart and the
  gap survives grid snapping as a pinhole in the middle of the country. Only combined shapes
  are affected; every other glyph is byte-identical.

## 0.1.2

### Patch Changes

- 7b56ce5: Document the projection in the README: equirectangular, what it costs in shape, and why a
  package of separately framed glyphs has no equal-area question to answer.

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
