/**
 * The 48×36 raster flag for a code, loaded on demand — ~640 bytes, whatever the country.
 *
 * Its own entry point rather than a function on the main one, and that is load-bearing
 * rather than tidy. A registry is a table of 242 literal dynamic imports, and a bundler
 * emits a chunk for every one it can see, whether or not the function that reads them is
 * ever called — tree-shaking removes dead code, but `import()` has already been counted
 * by then. Reached through the index, a build that only ever drew silhouettes emitted 484
 * flag chunks it could never request, a megabyte and a half of them.
 *
 * Split like this the question never comes up: chunks exist for the tiers you import.
 *
 *     import { loadFlag } from 'geoglyph/flags';
 *     const flag = await loadFlag('BR');
 */
export async function loadFlag(iso: string): Promise<string | null> {
  const { flagsPx } = await import('../generated/flag-px-registry.js');
  return (await flagsPx[iso.toUpperCase()]?.())?.flag ?? null;
}
