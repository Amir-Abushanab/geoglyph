# geoglyph

Every country as a mark the size of a letter — the outline it is recognised by, and its
flag to pour inside.

```js
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';
import { toSvg } from 'geoglyph/svg';

toSvg(shape, { flag, size: '1.5em' });
```

Two things already exist and this is neither of them. Flag sets are a solved problem —
use [flag-icons](https://github.com/lipis/flag-icons), which is where these come from.
Country paths exist too, but in a shared world-map coordinate space, for drawing a map.
A glyph is not a map: it is one country, framed on its own, at the size of a word next to
it. That framing is the whole package.

- **242 countries**, ISO 3166-1 alpha-2, including the ones a 1:110m sheet rounds away.
- **Public-domain geometry**, MIT code, no runtime dependencies.
- **One module per country per asset**, so a page naming three of them ships three.

## Install

```sh
npm install geoglyph
```

## Use

**When you know the country at build time**, import it. Nothing else comes with it.

```js
import shape from 'geoglyph/shape/cl';        // { d, viewBox }
import flag from 'geoglyph/flag-px/cl';       // 48×36 png data uri, ~640 B
import svg from 'geoglyph/flag/cl';           // the full svg source, any size
```

**When you don't** — a country a reader picked, or one dealt at random — `load` fetches
exactly the one module. The registry it reads is a table of literal imports, so bundlers
see through it and split it properly.

```js
import { load, has, CODES } from 'geoglyph';
import { loadFlag } from 'geoglyph/flags';        // 48×36 raster
import { loadFlagSvg } from 'geoglyph/flags-svg'; // svg source

if (has(code)) {
  const shape = await load(code);
  const flag = await loadFlag(code);
}
```

The three loaders live at three entry points on purpose. Each reads a registry of 242
literal dynamic imports, and a bundler emits a chunk for every one it can see — whether or
not the function reading them is ever called, because `import()` is counted before dead
code is removed. Behind one entry point, a build that only ever drew silhouettes emitted
484 flag chunks it could never request. Split, you get chunks for the tiers you import.

### React

```jsx
import { Glyph } from 'geoglyph/react';
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';

<Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
```

Deliberately dumb: it takes a shape rather than a country code, holds no state, runs no
effect and fetches nothing. A component that loaded its own data would put a request
waterfall behind every flag on a page and a loading state in every consumer. Pass a static
import when you know the country, and the result of `load()` when you do not — through
`use()`, a query cache, or whatever already owns your loading states.

`className`, `style`, `onClick`, `data-*` and a `ref` all land on the `<svg>`. React is an
optional peer dependency; nothing else in the package touches it.

### Anywhere else

Rendering is a string, not a component. A leaf node with no state has no business
picking a framework for you, so this works in Astro, in `dangerouslySetInnerHTML`, in a
template literal, in a Hugo partial, in `innerHTML`.

```js
toSvg(shape);                                    // silhouette in currentColor, 1em
toSvg(shape, { flag, size: 24, title: 'Chile' });
```

Both renderers produce the same markup, down to the clip path id — so one can render the
shell and the other an island without the hydration disagreeing.

The flag is drawn *over* the silhouette, not instead of it — so there is something to see
while the image is still arriving, and so a hover fades onto the shape rather than onto
nothing:

```css
.geoglyph-flag { opacity: 0; transition: opacity 150ms }
a:hover .geoglyph-flag { opacity: 1 }
```

## The crop, which is the point

Natural Earth gives a country every polygon it holds sovereignty over. So the United
States arrives with Alaska and Hawaii, and France with Réunion — and a box drawn around
all of that leaves the shape everyone recognises as a speck in an ocean of white.

Area cannot separate them. Alaska is 46% of the mainland by extent, and New Zealand's two
islands are within a tenth of each other and both have to stay. Any threshold that drops
Alaska drops the South Island.

Distance can. Start at the largest polygon and take in whatever touches it, then whatever
touches that, with a slack proportional to the country's own span. Tasmania, Corsica,
Northern Ireland, the Canadian Arctic and both New Zealands survive the trip; Hawaii and
Réunion do not.

Two more things follow from framing each country on its own:

- **Precision scales to the country.** One grid for the whole world is what makes Dominica
  — 0.14° across — vanish from a sheet that rounds to 0.1°. Here every country gets a grid
  a few hundredths of its own span, so Russia and Grenada come out described to about the
  same number of points.
- **Every shape sits at its own origin**, `viewBox="0 0 w h"`. That is what lets a flag be
  laid over it as `x="0" y="0" width="100%" height="100%"`, since an SVG percentage is a
  share of the viewport and knows nothing about where a viewBox begins.

Shapes keep their true aspect ratio — `w` and `h` are degrees, so Chile is tall and
Panama is wide. Draw them in a square box and they letterbox honestly.

## The two flag tiers

The flag is stretched to the shape's box, not fitted inside it. This is the only thing
that works: cropped to the outline of Peru a flag is a white stripe, where squeezed into
it it still reads red-white-red. At glyph size the bands are all that survives anyway.

`flag/` is the SVG. It scales to anything and is what a badge wants. It is also wildly
uneven, because a flag bearing a coat of arms *is* a coat of arms:

| | count |
| --- | --- |
| under 1 KB | 149 |
| 1–10 KB | 75 |
| over 10 KB | 47 |
| over 50 KB | 7 |

Median 804 bytes; Serbia is 177 KB. Per-country modules mean that lands only on whoever
asks for Serbia — but at 19px it buys about six visible pixels of eagle.

`flag-px/` is a 48×36 raster, **~640 bytes flat whatever the country**, as a data URI so
there is no asset pipeline, no base URL to configure and nothing to copy into `public/`.
That is the one to use when the flag is a fill inside a silhouette. It is the default for
`loadFlag`.

## API

| | |
| --- | --- |
| `geoglyph/shape/<iso>` | `{ d, viewBox }`, default export too |
| `geoglyph/flag/<iso>` | SVG source string |
| `geoglyph/flag-px/<iso>` | `data:image/png;base64,…`, 48×36 |
| `geoglyph` | `load`, `has`, `CODES`, `toSvg`, types |
| `geoglyph/svg` | `toSvg`, `clipIdFor`, `flagHref` |
| `geoglyph/react` | `Glyph` |
| `geoglyph/flags` | `loadFlag(iso)` → raster |
| `geoglyph/flags-svg` | `loadFlagSvg(iso)` → SVG source |

Subpath imports are lowercase (`geoglyph/shape/br`). `load`, `loadFlag` and `has` take
either case.

`toSvg` options: `size` (default `1em`), `fill` (default `currentColor`), `className`,
`flag`, `clipId`, `title`. A `flag` that starts with `<` is wrapped into a data URI for
you; anything else is treated as an address. Given a `title` the `<svg>` becomes
`role="img"`; without one it is `aria-hidden`. `clipId` defaults to a fingerprint of the
outline, so server and client agree and the same country twice is harmless — a shared
clip path clips both correctly.

## Sizes, measured

Bundled with esbuild, minified:

| | entry | chunks |
| --- | --- | --- |
| three countries + one flag, statically imported | 8.2 KB | none |
| `load()` only | 2.5 KB | 244, fetched on demand |
| `load()` + `loadFlag()` | 2.6 KB | 487, fetched on demand |

The tarball is 773 KB packed, 2.1 MB unpacked, 747 files. Most of that is the vector flag
tier, which is 1.5 MB of the total and which nobody downloads until they ask for a country.

## What is not in here

- **Subdivisions.** Countries only. No states, provinces or `gb-eng`.
- **A map.** Every shape is framed on its own; they do not share a coordinate space and
  cannot be assembled back into a world. Use TopoJSON for that.
- **Disputed borders, resolved.** These are Natural Earth's lines and its ISO codes,
  including the ones it marks disputed. The package takes no position it did not inherit.
- **Recognisable archipelagos.** Tokelau, the Marshall Islands and Tuvalu are scattered
  specks at any honest scale, and a glyph of them is scattered specks. There is no crop
  that fixes a country made of atolls.

## Regenerating

```sh
node scripts/build-shapes.mjs      # Natural Earth 1:50m → generated/shape
node scripts/build-flags.mjs       # flag-icons → generated/flag, generated/flag-px
node scripts/contact-sheet.mjs     # all 242, twice each, for eyeballing
```

The crop is a heuristic, and when a heuristic fails here it fails quietly — by drawing a
country nobody would recognise. There is no unit test for "looks like Italy", so the
contact sheet is the check. Open it and look.

## Publishing

Changesets, and one job with two states. `pnpm changeset` on anything that should reach
npm; merging it to master opens a "Version packages" pull request, and merging *that*
publishes — with provenance, after the same `pnpm check` that guards a local publish. So
master's head goes out as soon as it is green, and the only ceremony is the version PR.

`pnpm check` is build, typecheck, tests, [publint](https://publint.dev) and
[are-the-types-wrong](https://arethetypeswrong.github.io). The two attw rules that are
ignored — `no-resolution` and `cjs-resolves-to-esm` — are both the same fact stated twice:
this package is ESM-only by choice, and shipping types for a resolver that could never load
the code would be theatre.

## Licence

MIT. Geometry from Natural Earth (public domain), flags from flag-icons (MIT) — see
[NOTICE](./NOTICE).
