# geoglyph

![Twelve country outlines with their flags poured inside](https://raw.githubusercontent.com/Amir-Abushanab/geoglyph/master/scripts/dev/strip.png)

Every country as a mark the size of a letter: the outline it is recognised by, and its
flag to pour inside.

**[Open the playground](https://amir-abushanab.github.io/geoglyph/)** to see all 242 with
every option live.

```js
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';
import { toSvg } from 'geoglyph/svg';

toSvg(shape, { flag, size: '1.5em' });
```

- **242 countries**, ISO 3166-1 alpha-2, including the ones a 1:110m sheet rounds away.
- **Public-domain geometry**, MIT code, no runtime dependencies.
- **One module per country per asset**, so a page naming three of them ships three.

Flag sets already exist: use [flag-icons](https://github.com/lipis/flag-icons), which is
where these come from. Country paths exist too, but in a shared world-map coordinate space
for drawing a map. These are framed one country at a time instead, to be set at the size
of the word next to them.

## Install

```sh
pnpm install geoglyph
```

## Use

Know the country at build time? Import it. Nothing else comes with it.

```js
import shape from 'geoglyph/shape/cl';        // { d, viewBox }
import flag from 'geoglyph/flag-px/cl';       // 48×36 png data uri, ~640 B
import svg from 'geoglyph/flag/cl';           // full svg source, any size
```

Don't know it until runtime? `load` fetches exactly one module.

```js
import { load, has, CODES } from 'geoglyph';
import { loadFlag } from 'geoglyph/flags';        // 48×36 raster
import { loadFlagSvg } from 'geoglyph/flags-svg'; // svg source

if (has(code)) {
  const shape = await load(code);
  const flag = await loadFlag(code);
}
```

Three entry points, not one. Each reads a registry of 242 literal dynamic imports, and a
bundler emits a chunk for every one it can see, whether or not the function reading them
is ever called. Behind a single entry point, a build that only drew silhouettes still
emitted 484 flag chunks it could never request. Split, you get chunks for the tiers you
import.

### React

```jsx
import { Glyph } from 'geoglyph/react';
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';

<Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
```

`Glyph` takes a shape rather than a country code. It holds no state, runs no effect and
fetches nothing, so it can't put a request waterfall behind every flag on the page. Pass a
static import when you know the country, and the result of `load()` when you don't,
through `use()` or whatever already owns your loading states.

`className`, `style`, `onClick`, `data-*` and a `ref` all land on the `<svg>`. React is an
optional peer dependency.

### Anywhere else

Rendering returns a string, so it works in Astro, `dangerouslySetInnerHTML`, a template
literal, a Hugo partial, or `innerHTML`.

```js
toSvg(shape);                                    // silhouette in currentColor, 1em
toSvg(shape, { flag, size: 24, title: 'Chile' });
```

Both renderers agree on every option and on the clip, which is what a hydration boundary
needs. The output is a pure function of the shape and the options: no ids, no counters, no
document-wide state. (Not every byte, though. React writes `<path></path>` where the
string renderer writes `<path/>`.)

A flag replaces the silhouette rather than covering it. `backdrop` puts it back, which is
what the hover fade needs to land on:

```css
.geoglyph-flag { opacity: 0; transition: opacity 150ms }
a:hover .geoglyph-flag { opacity: 1 }
```

```js
toSvg(shape, { flag, backdrop: true });
```

## API

| | |
| --- | --- |
| `geoglyph/shape/<iso>` | `{ d, viewBox }`, default export too |
| `geoglyph/flag/<iso>` | SVG source string |
| `geoglyph/flag-px/<iso>` | `data:image/png;base64,…`, 48×36 |
| `geoglyph` | `load`, `has`, `CODES`, `toSvg`, types |
| `geoglyph/svg` | `toSvg`, `clipPathFor`, `flagHref` |
| `geoglyph/react` | `Glyph` |
| `geoglyph/flags` | `loadFlag(iso)` returns the raster |
| `geoglyph/flags-svg` | `loadFlagSvg(iso)` returns SVG source |

Subpath imports are lowercase (`geoglyph/shape/br`). `load`, `loadFlag` and `has` take
either case.

`toSvg` options: `size` (default `1em`), `fill` (default `currentColor`), `className`,
`flag`, `backdrop` (default `false`), `title`. A `flag` starting with `<` is wrapped into
a data URI; anything else is treated as an address. With a `title` the `<svg>` becomes
`role="img"`, without one it is `aria-hidden`.

## The crop

Natural Earth gives a country every polygon it holds sovereignty over, so the US arrives
with Alaska and Hawaii, and France with Réunion. A box round all of that leaves the
recognisable shape as a speck in an ocean of white.

Area can't separate them: Alaska is 46% of the mainland by extent, and New Zealand's two
islands are within a tenth of each other. Any threshold that drops Alaska drops the South
Island.

Distance can. Start at the largest polygon, take in whatever touches it, then whatever
touches that, with slack proportional to the country's span. Tasmania, Corsica, Northern
Ireland and both New Zealands survive. Hawaii and Réunion don't.

Two things follow:

- **Precision scales to the country.** One global grid is what makes Dominica (0.14°
  across) vanish from a sheet that rounds to 0.1°. Each country gets a grid a few
  hundredths of its own span, so Russia and Grenada get about the same number of points.
- **Every shape sits at its own origin**, `viewBox="0 0 w h"`, which is what lets a flag
  sit on it as `x="0" y="0" width="100%" height="100%"`.

`w` and `h` are degrees, so shapes keep their true aspect ratio. Chile is tall, Panama is
wide, and in a square box they letterbox.

## The projection

`x = lon + 180`, `y = 90 − lat`. Equirectangular, north up, and SVG user units are
degrees.

Nothing here is drawing a map. Every glyph is framed on its own and they share no
coordinate space, so no shape is ever set against another at a common scale, and the
Greenland-the-size-of-Africa reading a world map invites cannot arise — which is what the
UN's September 2026 resolution on map projections asks for. An equal-area projection
answers a question this package never puts.

What it costs is shape. A degree of longitude is `cos(lat)` of a degree of latitude on the
ground, so an outline comes out stretched east-west by `1/cos(lat)`: 1.0× on the equator,
1.15× at 30°, 2.0× at 60°, 2.4× for Iceland. Kenya and Indonesia are true, Norway and
Canada are wide. It is the stretch every unprojected lon/lat plot has, which is also what
most people have seen these outlines in.

Scaling `x` by the cosine of a shape's centre latitude would give it true proportions, and
change its `viewBox`. That is a fork of `scripts/build-shapes.mjs`, not an option on
`toSvg`.

## The two flag tiers

The flag is stretched to the shape's box, not fitted inside it. Cropped to the outline of
Peru a flag is a white stripe; squeezed into it, it still reads red-white-red. At glyph
size the bands are all that survives.

`flag/` is the SVG. It scales to anything and is what a badge wants. It is also uneven,
because a flag bearing a coat of arms is a coat of arms:

| | count |
| --- | --- |
| under 1 KB | 149 |
| 1-10 KB | 75 |
| over 10 KB | 47 |
| over 50 KB | 7 |

Median 804 bytes. Serbia is 177 KB, which lands only on whoever imports Serbia.

`flag-px/` is a 48×36 raster, **~640 bytes flat whatever the country**, as a data URI. No
asset pipeline, no base URL, nothing to copy into `public/`. Use it when the flag is a
fill inside a silhouette. It is the default for `loadFlag`.

## Sizes, measured

Bundled with esbuild, minified:

| | entry | fetched on demand |
| --- | --- | --- |
| three countries + one flag, static imports | 9.0 KB | nothing |
| `load()` only | 2.4 KB | 243 modules |
| `load()` + `loadFlag()` | 2.5 KB | 486 modules |

The tarball is 771 KB packed, 2.0 MB unpacked, 754 files. Most of that is the vector flag
tier, 1.5 MB of it, which nobody downloads until they ask for a country.

## What is not in here

- **Subdivisions.** Countries only. No states, provinces or `gb-eng`.
- **A map.** Every shape is framed on its own. They share no coordinate space and cannot
  be assembled back into a world. Use TopoJSON for that.
- **Disputed borders, resolved.** The geometry is Natural Earth's lines and its ISO codes,
  including the ones it marks disputed, and none of it is redrawn here. Which disputes get
  resolved for you is a build setting: see [Point of view](#point-of-view).
- **Recognisable archipelagos.** Tokelau, the Marshall Islands and Tuvalu are scattered
  specks at any honest scale, and a glyph of them is scattered specks. No crop fixes a
  country made of atolls.

The package takes sides on disputed territories when sufficient evidence is available.

## Two rendering decisions

**The clip is inline.** `clip-path: path('…')` on the `<image>`, not a `url(#…)` at a
`<clipPath>` element. A referenced clip needs an id, and an id derived from the outline is
the same for every glyph of that country, so the moment the copy that declared it stops
being rendered (offscreen under `content-visibility`, or unmounted while a twin survives)
the rest point at nothing. An invalid clip is *no* clip, so you get a rectangular flag
painted over the country. `path()` has been Baseline widely available since July 2020.

**A flag replaces the silhouette** rather than covering it, which is why `backdrop` exists
and is off. Two shapes sharing an antialiased edge don't add up to one edge: at a boundary
pixel with coverage `a` the fill contributes `a(1-a)`, a quarter of it at the halfway
point, so the silhouette shows as a hairline round the whole glyph. On Andorra at 300px
that's about 200 pixels of fill. Grouping or isolating measures identical; only not
painting the fill removes it.

Both are documented in `src/svg.ts` and `src/types.ts`.

## Developing

```sh
pnpm dev     # the playground: every glyph, every option, live
```

Builds the package, serves it off disk, rebuilds on save. The page imports `dist/` and the
generated modules the way a consumer would, so it exercises `toSvg` rather than imitating
it. Turn every option, filter, sort by path weight, and click a country for the markup it
returns and the import that gets it. `--port` moves it, `--open` opens a browser.

Every green push to master deploys it to
[amir-abushanab.github.io/geoglyph](https://amir-abushanab.github.io/geoglyph/). `pnpm
site` builds the same directory locally.

The counter under the controls shows the cost as a sum: 197 KB of outlines plus 205 KB of
raster flags is 403 KB for all 242, against 1.5 MB for the vector tier. Past 48px the page
recommends the vector tier, since a 48×36 raster at 120px is 2.5× past its own pixels.

## Regenerating

```sh
node scripts/build-shapes.mjs      # Natural Earth 1:50m into generated/shape
node scripts/build-flags.mjs       # flag-icons into generated/flag, generated/flag-px
node scripts/contact-sheet.mjs     # all 242, twice each, for eyeballing
pnpm banner                        # the social card and the strip above
pnpm llms                          # llms.txt, the agent-facing API reference
pnpm site                          # the playground, laid out the way Pages serves it
```

`llms.txt` is generated from `package.json`, the type definitions and `CODES`, and ships
in the tarball and at the site root. `pnpm check` fails if it is stale or if `SvgOptions`
gained an option it doesn't document.

The card and the strip call the package over its own generated modules, so a change to the
crop shows up in them. They're the one place that doesn't use `toSvg` verbatim: librsvg
rasterises them and ignores `clip-path: path('…')`, so they clip with a `<clipPath>`
element instead.

The crop is a heuristic and fails quietly, by drawing a country nobody would recognise.
There's no unit test for "looks like Italy", so the contact sheet is the check.

### Point of view

Natural Earth files every contested area more than once. Alongside `ADM0_A3` it carries
`ADM0_A3_RU`, `ADM0_A3_CN`, `ADM0_A3_US` and thirty more, each naming who that ground
belongs to as far as that state is concerned:

```sh
GEOGLYPH_POV=UA pnpm vendor    # Crimea in Ukraine, no Kosovo
GEOGLYPH_POV=RU pnpm vendor    # Crimea in Russia, Kosovo in Serbia, Taiwan in China
GEOGLYPH_POV=CN pnpm vendor    # Taiwan in China, Kosovo in Serbia
GEOGLYPH_POV=MA pnpm vendor    # Western Sahara in Morocco
GEOGLYPH_POV=AR pnpm vendor    # the Falklands and South Georgia in Argentina
```

Reassigned ground joins the country that viewpoint gives it to. An entity it doesn't
recognise loses its glyph, its code and both its flags, so `GEOGLYPH_POV=RU` ships 240
countries rather than 242.

A viewpoint also attributes ground that has no code of its own. Unset, the sheet is keyed
on each feature's ISO alpha-2 and land filed without one is never drawn: Crimea sits under
`RUS` with no alpha-2, so by default it's in nobody's outline.

The build prints every reassignment, because the columns carry the occasional mistake.
`ADM0_A3_AR`, for instance, files Barbados under Uruguay. Read the list before shipping a
sheet cut this way.

Unset uses Natural Earth's default assignment, which is what this package ships.

## Publishing

Run `pnpm changeset` on anything that should reach npm. Merging it to master opens a
"Version packages" pull request; merging that publishes, with provenance, after the same
`pnpm check` that guards a local publish.

`pnpm check` is build, typecheck, [oxlint](https://oxc.rs), [oxfmt](https://oxc.rs) in
check mode, tests, [publint](https://publint.dev) and
[are-the-types-wrong](https://arethetypeswrong.github.io).

Two attw rules are ignored. `cjs-resolves-to-esm` says the package is ESM-only, which it
is. `no-resolution` is TypeScript's legacy `node10` resolution, which cannot read
`exports`: `main` and `types` get it to the root entry point, and nothing gets it to a
subpath.

## Licence

MIT. Geometry from Natural Earth (public domain), flags from flag-icons (MIT). See
[NOTICE](https://github.com/Amir-Abushanab/geoglyph/blob/master/NOTICE).
