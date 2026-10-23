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

245 countries by ISO 3166-1 alpha-2 code, five blocs of them and the world, with no runtime
dependencies. Each country is its own module, so you only ship the ones you import.

Six codes aren't countries, and flag-icons draws a flag for each. Five are blocs, drawn as
their members dissolved into one outline, each member cropped the way its own glyph is:

- `EU`, the European Union: its 27 members. ISO 3166 reserves the code for it.
- `ASEAN`, the Association of Southeast Asian Nations: its 11 members, Timor-Leste included.
- `EAC`, the East African Community: its 8 members, Somalia and the DR Congo included.
- `ARAB`, the Arab League: its 22 members, Syria and the Comoros included.
- `PC`, the Pacific Community, standing in for Oceania: Australia, New Zealand and the 22
  Pacific island countries and territories. France, the UK and the US are members too, for
  the territories they held, but their mainlands are left out, or the Pacific would be a
  speck between them. It is drawn with the date line in the middle, and its islands, far too
  small to see at this scale, as dots.

`UN` is the world: every piece of land in one outline, filled with the UN flag. Nothing is
cropped from it, and Antarctica is left out, as the UN emblem leaves it out.

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
- Fiji is drawn across the date line, which cuts it in two. Kiribati and Micronesia, atolls
  strung out over thousands of kilometres, are each their largest island: Kiritimati and
  Pohnpei.
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
