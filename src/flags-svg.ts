/**
 * The vector flag for a code, loaded on demand. Scales to anything, and is uneven in a
 * way the raster tier is not: a flag bearing a coat of arms is a coat of arms, so half
 * are under a kilobyte and Serbia is 177 of them.
 *
 * Its own entry point for the same reason `geoglyph/flags` is — see the note there. Use
 * this one when the flag is drawn larger than a word; use the raster when it is a fill
 * inside a silhouette, where the detail buys about six visible pixels.
 *
 *     import { loadFlagSvg } from 'geoglyph/flags-svg';
 *     const flag = await loadFlagSvg('BR');
 */
export async function loadFlagSvg(iso: string): Promise<string | null> {
  const { flags } = await import('../generated/flag-registry.js');
  return (await flags[iso.toUpperCase()]?.())?.flag ?? null;
}
