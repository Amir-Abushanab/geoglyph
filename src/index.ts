/**
 * geoglyph — every country as a mark the size of a letter.
 *
 * Two ways in, and which you want depends on whether you know the country at build time.
 *
 * Statically, when you do. One module per country, so a page that names three of them
 * ships three outlines and not a world map:
 *
 *     import shape from 'geoglyph/shape/br';
 *     import flag from 'geoglyph/flag-px/br';
 *     import { toSvg } from 'geoglyph/svg';
 *     toSvg(shape, { flag, size: '1.5em' });
 *
 * Dynamically, when you do not — a country picked by a reader, or dealt at random.
 * `load` imports exactly the one module and nothing else:
 *
 *     const shape = await load('BR');
 *
 * Flags load the same way, from their own entry points — `geoglyph/flags` for the raster
 * and `geoglyph/flags-svg` for the vector. They are separate on purpose; see the note
 * above the registry import below.
 */
export type { Shape, SvgOptions } from './types.js';
export type { BlockOptions } from './blocks.js';
export { toSvg } from './svg.js';
export { toBlocks } from './blocks.js';

import { CODES, REGIONS } from '../generated/codes.js';
import type { Shape } from './types.js';

/** Every country this package has a glyph for, by ISO 3166-1 alpha-2 code, sorted. */
export { CODES };

/**
 * The codes that are not countries, sorted, kept out of `CODES` so a list of countries built
 * from it has none of them in it. Five blocs, each drawn as its members in one outline —
 * `EU`, which ISO 3166 reserves for the European Union, `ASEAN`, `EAC`, `ARAB` and `PC` —
 * and the world, `UN`. Everything else takes them as it takes a country: `load`, `has`, the
 * flag loaders and the `shape/`, `flag/` and `flag-px/` subpaths.
 */
export { REGIONS };

const known = new Set([...CODES, ...REGIONS]);

/**
 * Whether there is a glyph for a code, country or region, without loading anything — not
 * the glyph, and not the table of them either. Answered from `CODES` and `REGIONS`, which
 * are a kilobyte of strings and the only part of the lookup machinery that is worth having
 * in a bundle unconditionally.
 */
export const has = (iso: string): boolean => known.has(iso.toUpperCase());

/*
 * The three registries are reached through `import()` inside these functions rather than
 * at the top of the file, and that is load-bearing rather than stylistic. A registry is a
 * table of 251 literal dynamic imports; a bundler that can see one emits a chunk for every
 * country in it. Imported at module scope, all three stay reachable from this module even
 * when a consumer never calls the function that reads them — a build that only ever draws
 * silhouettes was emitting 484 flag chunks it could never request.
 *
 * Inside an unused exported function the whole body goes, dynamic import and all. The cost
 * is one extra round trip on the first call of each kind, for a chunk the module system
 * then keeps.
 */

/** The outline for a code, or null for one Natural Earth's sheet does not carry. */
export async function load(iso: string): Promise<Shape | null> {
  const { shapes } = await import('../generated/shape-registry.js');
  const open = shapes[iso.toUpperCase()];
  return open === undefined ? null : (await open()).shape;
}
