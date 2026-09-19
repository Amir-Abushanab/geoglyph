# geoglyph

![Twelve country outlines with their flags poured inside](https://raw.githubusercontent.com/Amir-Abushanab/geoglyph/master/scripts/dev/strip.png)

Every country as a mark the size of a letter: its outline, and its flag to pour inside.

**[Open the playground](https://amir-abushanab.github.io/geoglyph/)** to see all 242 with
every option live.

```js
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';
import { toSvg } from 'geoglyph/svg';

toSvg(shape, { flag, size: '1.5em' });
```

- **242 countries**, ISO 3166-1 alpha-2, including the small ones a 1:110m map drops.
- **Public-domain geometry**, MIT code, no runtime dependencies.
- **One module per country per asset**, so a page that names three countries ships three.

`IL` and `PS` are both drawn as the whole territory between the river and the sea, filled
with the Palestinian flag. It's the one deliberate departure from the sources.

For flags alone, use [flag-icons](https://github.com/lipis/flag-icons), where these come
from. Map datasets draw every country in one shared coordinate space; these are framed one
country at a time, sized to sit next to a word.

## Install

```sh
pnpm install geoglyph
```

## Use

Know the country at build time? Import it. Nothing else comes with it.

```js
import shape from 'geoglyph/shape/cl';   // { d, viewBox }
import flag from 'geoglyph/flag-px/cl';  // 48×36 png data uri, ~640 B
import svg from 'geoglyph/flag/cl';      // svg source, any size
```

Only know it at runtime? `load` fetches one module.

```js
import { load, has, CODES } from 'geoglyph';
import { loadFlag } from 'geoglyph/flags';        // 48×36 raster
import { loadFlagSvg } from 'geoglyph/flags-svg'; // svg source

if (has(code)) {
  const shape = await load(code);
  const flag = await loadFlag(code);
}
```

The loaders are three entry points so a bundler only emits chunks for the tiers you import.
Behind one entry point, a build that only drew silhouettes still emitted 484 flag chunks.

### React

```jsx
import { Glyph } from 'geoglyph/react';
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';

<Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
```

`Glyph` takes a shape, not a country code. It holds no state and fetches nothing: pass a
static import, or the result of `load()` through `use()` or your own loading state.
`className`, `style`, `onClick`, `data-*` and `ref` go on the `<svg>`. React is an optional
peer dependency.

### Anywhere else

`toSvg` returns a string, for Astro, `innerHTML`, a template literal or a Hugo partial.

```js
toSvg(shape);                                    // silhouette in currentColor, 1em
toSvg(shape, { flag, size: 24, title: 'Chile' });
```

`toSvg` and `Glyph` agree on every option and use no ids or document-wide state, so they're
safe across a hydration boundary. (React writes `<path></path>` where `toSvg` writes
`<path/>`.)

A flag replaces the silhouette. To fade the flag in on hover, pass `backdrop` so there is a
silhouette underneath:

```css
.geoglyph-flag { opacity: 0; transition: opacity 150ms }
a:hover .geoglyph-flag { opacity: 1 }
```

```js
toSvg(shape, { flag, backdrop: true });
```

### Blocks

![The same twelve countries in blocks, flags poured inside](https://raw.githubusercontent.com/Amir-Abushanab/geoglyph/master/scripts/dev/blocks.png)

```js
import { toBlocks } from 'geoglyph/blocks';

toSvg(toBlocks(shape, { cells: 10 }));
```

The outline snapped to square cells, `cells` along its longer side (default 10). It returns
a shape, so `Glyph` and flags work with it too. Add `shape-rendering: crispEdges` for hard
edges.

## API

| | |
| --- | --- |
| `geoglyph/shape/<iso>` | `{ d, viewBox }`, default export too |
| `geoglyph/flag/<iso>` | SVG source string |
| `geoglyph/flag-px/<iso>` | `data:image/png;base64,…`, 48×36 |
| `geoglyph` | `load`, `has`, `CODES`, `toSvg`, `toBlocks`, types |
| `geoglyph/svg` | `toSvg`, `clipPathFor`, `flagHref` |
| `geoglyph/blocks` | `toBlocks(shape, { cells })` returns a blocky shape |
| `geoglyph/react` | `Glyph` |
| `geoglyph/flags` | `loadFlag(iso)` returns the raster |
| `geoglyph/flags-svg` | `loadFlagSvg(iso)` returns SVG source |

Subpath imports are lowercase (`geoglyph/shape/br`). `load`, `loadFlag` and `has` take
either case.

`toSvg` options: `size` (default `1em`), `fill` (default `currentColor`), `className`,
`flag`, `backdrop` (default `false`), `title`. A `flag` starting with `<` is treated as SVG
source and wrapped in a data URI; anything else is used as a URL. With a `title` the
`<svg>` gets `role="img"`; without one it's `aria-hidden`.

## The crop

Natural Earth gives a country every polygon it holds, so the US comes with Alaska and
Hawaii, and France with Réunion. Framed whole, the shape people recognise is a speck.

Area can't separate them: Alaska is 46% of the mainland by extent, and New Zealand's two
islands are within a tenth of each other, so any threshold that drops Alaska drops the South
Island. Distance can. Start at the largest polygon, add whatever touches it, then whatever
touches that, with slack proportional to the country's span. Tasmania, Corsica, Northern
Ireland and both New Zealand islands stay; Hawaii and Réunion don't.

- **Precision scales with the country.** A single global grid is what rounds Dominica
  (0.14° across) away on a sheet that rounds to 0.1°. Each country gets a grid a few
  hundredths of its own span, so Russia and Grenada get about the same number of points.
- **Every shape sits at its own origin**, `viewBox="0 0 w h"`, so a flag fits it at
  `x="0" y="0" width="100%" height="100%"`.

`w` and `h` are degrees, so shapes keep their aspect ratio. Chile is tall, Panama is wide,
and both letterbox in a square box.

## The projection

`x = lon + 180`, `y = 90 − lat`: equirectangular, north up, in degrees.

Each glyph is framed on its own, so no two shapes are compared at a common scale and the
Greenland-the-size-of-Africa problem can't come up, which is what the UN's September 2026
resolution on map projections asks for. An equal-area projection would solve a problem this
package doesn't have.

The cost is shape. A degree of longitude is `cos(lat)` of a degree of latitude on the
ground, so outlines are stretched east-west by `1/cos(lat)`: 1.0× on the equator, 1.15× at
30°, 2.0× at 60°, 2.4× for Iceland. Kenya and Indonesia are true; Norway and Canada are
wide. It's the stretch every unprojected lon/lat plot has, so it's how most people have
seen these outlines anyway.

For true proportions, scale `x` by the cosine of each shape's centre latitude in
`scripts/build-shapes.mjs`. That changes the `viewBox`, so it's a fork, not a `toSvg` option.

## The two flag tiers

A flag is stretched to the shape's box rather than fitted inside it. Clipped to Peru at its
own proportions, Peru's flag is mostly its white band; stretched, it still reads
red-white-red.

`flag/` is SVG. It scales to any size, and its weight depends on the heraldry:

| | count |
| --- | --- |
| under 1 KB | 149 |
| 1-10 KB | 75 |
| over 10 KB | 47 |
| over 50 KB | 7 |

Median 804 bytes. Serbia is 177 KB, and only whoever imports Serbia pays for it.

`flag-px/` is a 48×36 raster, **about 640 bytes whatever the country**, as a data URI, so
there's no asset pipeline and nothing to copy into `public/`. Use it for a flag inside a
silhouette. It's the default for `loadFlag`.

## Sizes, measured

Bundled with esbuild, minified:

| | entry | fetched on demand |
| --- | --- | --- |
| three countries + one flag, static imports | 9.0 KB | nothing |
| `load()` only | 2.4 KB | 243 modules |
| `load()` + `loadFlag()` | 2.5 KB | 486 modules |

The tarball is 771 KB packed, 2.0 MB unpacked, 756 files. 1.5 MB of that is the vector flag
tier, which nobody downloads until they ask for a country.

## What's not in here

- **Subdivisions.** Countries only: no states, provinces or `gb-eng`.
- **A map.** Shapes share no coordinate space and can't be assembled into a world. Use
  TopoJSON for that.
- **Disputed borders, resolved.** The geometry is Natural Earth's lines and ISO codes,
  including the ones it marks disputed, redrawn nowhere except `IL` and `PS`. Other
  viewpoints are a build setting: [point of view](#point-of-view).
- **Recognisable archipelagos.** Tokelau, the Marshall Islands and Tuvalu are scattered
  specks at any honest scale, so their glyphs are too.

## Two rendering decisions

**The clip is inline**: `clip-path: path('…')` on the `<image>`, not `url(#…)` pointing at
a `<clipPath>`. A referenced clip needs an id, and every glyph of one country would share
it. Once the element declaring it stops rendering (offscreen under `content-visibility`, or
unmounted while a copy survives), the others lose their clip and paint the flag as a
rectangle. `path()` has been Baseline widely available since July 2020.

**A flag replaces the silhouette** instead of covering it, which is why `backdrop` exists
and is off by default. Two shapes sharing an antialiased edge don't make one clean edge: at
a pixel with coverage `a`, the fill underneath contributes `a(1-a)`, up to a quarter at the
halfway point, so the silhouette shows as a hairline around the glyph. On Andorra at 300px
that's about 200 pixels. Grouping or isolation doesn't help; only not painting the fill
does.

Both are documented in `src/svg.ts` and `src/types.ts`.

## Developing

```sh
pnpm dev     # the playground: every glyph, every option, live
```

Builds the package, serves it off disk and rebuilds on save. The page imports `dist/` and
the generated modules as a consumer would, so it exercises `toSvg` rather than imitating
it. Click a country for its markup and the import that gets it. `--port` changes the port;
`--open` opens a browser.

Every green push to master deploys it to
[amir-abushanab.github.io/geoglyph](https://amir-abushanab.github.io/geoglyph/). `pnpm site`
builds the same directory locally.

The counter under the controls sums the cost: 199 KB of outlines plus 205 KB of raster
flags is 404 KB for all 242, against 1.5 MB for the vector tier. Past 48px the page
suggests the vector tier, since a 48×36 raster at 120px is 2.5× past its own pixels.

## Regenerating

```sh
node scripts/build-shapes.mjs      # Natural Earth 1:50m into generated/shape
node scripts/build-flags.mjs       # flag-icons into generated/flag, generated/flag-px
node scripts/contact-sheet.mjs     # all 242, twice each, for eyeballing
pnpm banner                        # the social card and the strips in this README
pnpm llms                          # llms.txt, the agent-facing API reference
pnpm site                          # the playground, laid out the way Pages serves it
```

`llms.txt` is generated from `package.json`, the type definitions and `CODES`, and ships in
the tarball and at the site root. `pnpm check` fails if it's stale or if `SvgOptions` gains
an option it doesn't document.

The card and the strips are drawn from the package's own modules, so a change to the crop
shows up in them. They clip with a `<clipPath>` element instead of the inline clip, because
librsvg, which renders them, ignores `clip-path: path('…')`.

The crop is a heuristic and fails quietly, by drawing a country nobody would recognise.
There's no unit test for "looks like Italy", so the contact sheet is the check.

### Point of view

Natural Earth files contested areas more than once. Besides `ADM0_A3` it has `ADM0_A3_RU`,
`ADM0_A3_CN`, `ADM0_A3_US` and thirty more, each assigning that ground the way that state
does:

```sh
GEOGLYPH_POV=UA pnpm vendor    # Crimea in Ukraine, no Kosovo
GEOGLYPH_POV=RU pnpm vendor    # Crimea in Russia, Kosovo in Serbia, Taiwan in China
GEOGLYPH_POV=CN pnpm vendor    # Taiwan in China, Kosovo in Serbia
GEOGLYPH_POV=MA pnpm vendor    # Western Sahara in Morocco
GEOGLYPH_POV=AR pnpm vendor    # the Falklands and South Georgia in Argentina
```

Reassigned ground joins the country that viewpoint gives it to. An entity the viewpoint
doesn't recognise loses its glyph, its code and both flags, so `GEOGLYPH_POV=RU` ships 240
countries instead of 242.

A viewpoint also assigns ground that has no code of its own. Without one, the sheet is keyed
on each feature's ISO alpha-2, and land without one is never drawn: Crimea sits under `RUS`
with no alpha-2, so by default it's in nobody's outline.

The build prints every reassignment, because the columns have mistakes: `ADM0_A3_AR` files
Barbados under Uruguay. Read the list before shipping a sheet built this way.

The published package uses Natural Earth's default assignment.

## Publishing

Add a changeset (`pnpm changeset`) to anything that should reach npm. Merging to master
opens a "Version packages" pull request; merging that publishes with provenance, after the
same `pnpm check` a local publish runs.

`pnpm check` runs the build, typecheck, [oxlint](https://oxc.rs), [oxfmt](https://oxc.rs)
in check mode, tests, [publint](https://publint.dev) and
[are-the-types-wrong](https://arethetypeswrong.github.io). Two attw rules are ignored:
`cjs-resolves-to-esm`, because the package is ESM-only, and `no-resolution`, because
TypeScript's legacy `node10` resolution can't read `exports` (`main` and `types` reach the
root entry point; nothing reaches a subpath).

## Licence

MIT. Geometry from Natural Earth (public domain), flags from flag-icons (MIT). See
[NOTICE](https://github.com/Amir-Abushanab/geoglyph/blob/master/NOTICE).
