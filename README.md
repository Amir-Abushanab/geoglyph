# geoglyph

![Twelve country outlines with their flags poured inside](https://raw.githubusercontent.com/Amir-Abushanab/geoglyph/master/scripts/dev/strip.png)

Country outlines as SVG glyphs, sized to sit in a line of text, with each country's flag to
fill them. Try every option in the [playground](https://amir-abushanab.github.io/geoglyph/).

```sh
pnpm install geoglyph
```

```js
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';
import { toSvg } from 'geoglyph/svg';

toSvg(shape, { flag, size: '1.5em' });
```

242 countries by ISO 3166-1 alpha-2 code, with no runtime dependencies. Each country is its
own module, so you only ship the ones you import.

`IL` and `PS` are both drawn as the whole territory between the river and the sea, filled
with the Palestinian flag. Everything else is as Natural Earth and flag-icons ship it.

## Loading at runtime

```js
import { load, has } from 'geoglyph';
import { loadFlag } from 'geoglyph/flags';        // 48×36 png
import { loadFlagSvg } from 'geoglyph/flags-svg'; // svg

if (has(code)) {
  const shape = await load(code);
  const flag = await loadFlag(code);
}
```

## React

```jsx
import { Glyph } from 'geoglyph/react';

<Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
```

`Glyph` takes a shape, not a country code, and fetches nothing. Other props go on the
`<svg>`.

## Blocks

![The same twelve countries in blocks, flags poured inside](https://raw.githubusercontent.com/Amir-Abushanab/geoglyph/master/scripts/dev/blocks.png)

```js
import { toBlocks } from 'geoglyph/blocks';

toSvg(toBlocks(shape, { cells: 10 }));
```

Snaps the outline to square cells, `cells` along the longer side (default 10). Add
`shape-rendering: crispEdges` for hard edges.

## API

| | |
| --- | --- |
| `geoglyph/shape/<iso>` | `{ d, viewBox }` |
| `geoglyph/flag/<iso>` | SVG source |
| `geoglyph/flag-px/<iso>` | 48×36 PNG data URI |
| `geoglyph` | `load`, `has`, `CODES`, `toSvg`, `toBlocks` |
| `geoglyph/svg` | `toSvg`, `clipPathFor`, `flagHref` |
| `geoglyph/blocks` | `toBlocks` |
| `geoglyph/react` | `Glyph` |
| `geoglyph/flags` | `loadFlag` |
| `geoglyph/flags-svg` | `loadFlagSvg` |

`toSvg(shape, options)` takes `size` (default `1em`), `fill` (default `currentColor`),
`className`, `flag`, `backdrop` and `title`.

- `flag` is a URL, a data URI or SVG source. It replaces the silhouette; set `backdrop` to
  draw the silhouette under it, for example to fade the flag in on hover.
- With a `title` the `<svg>` gets `role="img"`; without one it's `aria-hidden`.
- Subpath imports are lowercase. `load`, `loadFlag` and `has` take either case.

## Flags

`flag-px/` is a 48×36 PNG, about 640 bytes whatever the country. `flag/` is the SVG: median
804 bytes, but up to 177 KB for Serbia. Either way the flag is stretched to the shape's box,
so its stripes still read inside a narrow country.

## Shapes

- Each country is cropped to its main landmass: the US without Alaska and Hawaii, France
  without Réunion. Nearby islands like Tasmania, Corsica and both of New Zealand stay.
- Coordinates are plain longitude and latitude, so countries far from the equator come out
  wide. Norway and Canada are stretched; Kenya and Indonesia are true.
- No states or provinces, and the shapes don't share a coordinate space, so they can't be
  put back together into a map. Use TopoJSON for that.
- `GEOGLYPH_POV=RU pnpm vendor` rebuilds the shapes with disputed areas assigned the way
  that country assigns them. `UA`, `CN`, `MA`, `AR` and others work too; an unsupported code
  prints the list. The published package uses Natural Earth's default.

## Development

```sh
pnpm dev       # playground
pnpm check     # build, types, lint, format, tests, publint, attw
pnpm vendor    # rebuild shapes and flags from Natural Earth and flag-icons
pnpm banner    # the images in this README
```

Add a changeset with `pnpm changeset` for anything that should be released.

## Licence

MIT. Geometry from Natural Earth (public domain), flags from flag-icons (MIT). See
[NOTICE](https://github.com/Amir-Abushanab/geoglyph/blob/master/NOTICE).
