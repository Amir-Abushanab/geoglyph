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
 * Dynamically, when you do not — a country picked by a user, or dealt at random. `load`
 * imports exactly the one module and nothing else, and bundlers see through it because
 * the registry it reads is a table of literal imports:
 *
 *     const shape = await load('BR');
 *     const flag = await loadFlag('BR');
 */
export type { Shape, SvgOptions } from './types.js';
export { toSvg } from './svg.js';

import { shapes } from '../generated/shape-registry.js';
import { flags } from '../generated/flag-registry.js';
import { flagsPx } from '../generated/flag-px-registry.js';
import { CODES } from '../generated/codes.js';
import type { Shape } from './types.js';

/** Every ISO 3166-1 alpha-2 code this package has a glyph for, sorted. */
export { CODES };

/** Whether there is a glyph for a code, without loading it. */
export const has = (iso: string): boolean => shapes[iso.toUpperCase()] !== undefined;

/** The outline for a code, or null for one Natural Earth's sheet does not carry. */
export async function load(iso: string): Promise<Shape | null> {
  const open = shapes[iso.toUpperCase()];
  return open === undefined ? null : (await open()).shape;
}

/**
 * The flag for a code.
 *
 * `raster` is the choice between the two tiers, and it is a choice about size rather than
 * about quality. The SVG scales to anything and is what a badge wants; it is also uneven,
 * because a flag bearing a coat of arms is a coat of arms — half are under a kilobyte and
 * Serbia is 177 of them. At glyph size that detail is spent on about six visible pixels,
 * so the 48×36 raster — a flat ~640 bytes, whatever the country — is the honest default
 * for a flag filling a silhouette.
 */
export async function loadFlag(iso: string, options: { raster?: boolean } = {}): Promise<string | null> {
  const table = options.raster === false ? flags : flagsPx;
  const open = table[iso.toUpperCase()];
  return open === undefined ? null : (await open()).flag;
}
