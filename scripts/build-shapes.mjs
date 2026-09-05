/**
 * Turns a world map into 250 glyphs.
 *
 * SOURCE. Natural Earth 1:50m Admin 0 – Map subunits, public domain, from the project's
 * own vector repository. Subunits rather than countries because that is the layer that
 * gives French Guiana a code of its own instead of folding it into France — and because
 * the 1:110m sheet everyone reaches for first cannot hold a country narrower than its own
 * rounding, which is most of the Caribbean.
 *
 * The projection is equirectangular and unapologetic: x = lon + 180, y = 90 − lat, so
 * SVG user units are degrees and north is up. Nothing here is drawing a map, so there is
 * no case for a projection that trades area against shape to make an argument.
 *
 * The two things this does that a map generator does not:
 *
 * 1. CROP. Natural Earth gives a country every polygon it holds sovereignty over, so the
 *    United States arrives with Alaska and Hawaii and France with Réunion. A box drawn
 *    round all of that leaves the shape everyone recognises as a speck in an ocean of
 *    white. Area cannot separate them — Alaska is 46% of the mainland, and New Zealand's
 *    two islands are within a tenth of each other and must both stay. Distance can: start
 *    at the largest polygon and take in whatever touches it, then whatever touches that.
 *    Tasmania, Northern Ireland, the Canadian Arctic and both New Zealands survive;
 *    Réunion and Hawaii do not.
 *
 * 2. SCALE THE PRECISION TO THE COUNTRY. A glyph is framed on its own, so what matters is
 *    detail relative to the shape rather than to the globe. One grid for everything is
 *    what makes Dominica — 0.14° across — vanish from a sheet that rounds to 0.1°. Every
 *    country gets a grid a few hundredths of its own span, so Russia and Grenada come out
 *    described to about the same number of points.
 *
 *   node scripts/build-shapes.mjs
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_subunits.geojson';
const OUT = join(root, 'generated', 'shape');

/** How many points across its own span a shape is worth describing to. */
const DETAIL = 400;
/** Floors and ceilings for that, in degrees: finer than a hundredth of a degree is noise
    at any size a glyph is drawn, and coarser than a tenth loses the coastline. */
const FINEST = 0.002;
const COARSEST = 0.1;
/** A ring smaller than this share of the country's span is a speck, not an island. */
const SPECK = 1 / 90;
/** How far apart two polygons can sit and still be one landmass, as a share of the span,
    capped: two degrees of sea is a strait, twenty is an overseas department. */
const REACH = 0.05;
const REACH_MAX = 2;

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/**
 * Douglas–Peucker. Natural Earth carries a lot of points that survive rounding as
 * collinear neighbours — three vertices describing one straight coast — and dropping
 * them is free accuracy-wise and is most of the file.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const dx = bx - ax;
  const dy = by - ay;
  const span = Math.hypot(dx, dy);
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const distance =
      span === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / span;
    if (distance > worst) {
      worst = distance;
      at = i;
    }
  }
  if (worst <= tolerance) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, at + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(at), tolerance),
  ];
}

const project = (ring) => ring.map(([lon, lat]) => [lon + 180, 90 - lat]);

function boxOf(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
const spanOf = (box) => Math.max(box.maxX - box.minX, box.maxY - box.minY);
const union = (a, b) => ({
  minX: Math.min(a.minX, b.minX),
  maxX: Math.max(a.maxX, b.maxX),
  minY: Math.min(a.minY, b.minY),
  maxY: Math.max(a.maxY, b.maxY),
});
const within = (a, b, slack) =>
  a.minX - slack <= b.maxX &&
  b.minX - slack <= a.maxX &&
  a.minY - slack <= b.maxY &&
  b.minY - slack <= a.maxY;

/** Outer rings only. The one hole worth anything is Lesotho, and it is its own glyph. */
const ringsOf = (geometry) =>
  (geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []
  ).map((polygon) => project(polygon[0]));

/** Relative commands, and no separator where the sign already is one: a coastline is a
    run of short hops, so `l.3-1.2` says what `L123.4 56.7` says in a third of the room. */
const digits = (grid) => Math.max(0, Math.ceil(-Math.log10(grid)));
const num = (n, places) => {
  const text = String(Number(n.toFixed(places)));
  return text.startsWith('0.')
    ? text.slice(1)
    : text.startsWith('-0.')
      ? `-${text.slice(2)}`
      : text;
};
const step = (dx, dy, places) => {
  const x = num(dx, places);
  const y = num(dy, places);
  return y.startsWith('-') ? `${x}${y}` : `${x} ${y}`;
};

function ringPath(points, origin, grid, places) {
  const snapped = [];
  let last = null;
  for (const [rawX, rawY] of points) {
    const x = Number((Math.round((rawX - origin.x) / grid) * grid).toFixed(places));
    const y = Number((Math.round((rawY - origin.y) / grid) * grid).toFixed(places));
    if (last !== null && last[0] === x && last[1] === y) continue;
    snapped.push([x, y]);
    last = [x, y];
  }
  if (snapped.length < 4) return null;
  // Closed with Z rather than by repeating the first point.
  if (snapped.at(-1)[0] === snapped[0][0] && snapped.at(-1)[1] === snapped[0][1]) snapped.pop();
  let out = `M${step(snapped[0][0], snapped[0][1], places)}l`;
  for (let i = 1; i < snapped.length; i += 1) {
    out += step(snapped[i][0] - snapped[i - 1][0], snapped[i][1] - snapped[i - 1][1], places);
    if (i < snapped.length - 1) out += ',';
  }
  return `${out}Z`;
}

/**
 * A JS string literal that does not fight the content. `JSON.stringify` escapes every
 * double quote, and an SVG is mostly double quotes — 38KB of backslashes across the flag
 * set, for nothing. Single quotes are rare in markup and common in nothing else here.
 */
const quote = (text) =>
  `'${text.replace(/[\\'\n\r\u2028\u2029]/g, (c) => ({ '\n': '\\n', '\r': '\\r', '\u2028': '\\u2028', '\u2029': '\\u2029' })[c] ?? `\\${c}`)}'`;

/** Air around the shape, as a share of its longer side, so it never sits on the edge. */
const AIR = 0.04;

export function glyphOf(rings) {
  if (rings.length === 0) return null;
  const whole = boxOf(rings.flat());
  const span = spanOf(whole);
  if (span === 0) return null;

  const grid = clamp(span / DETAIL, FINEST, COARSEST);
  const places = digits(grid);

  /* Specks first: an islet the size of the grid is a rounding artefact, and leaving it in
     lets the crop reach across an ocean through a chain of them. */
  const parts = rings
    .map((ring) => ({ ring, box: boxOf(ring) }))
    .filter((part) => spanOf(part.box) >= span * SPECK)
    .toSorted((a, b) => spanOf(b.box) - spanOf(a.box));
  if (parts.length === 0) return null;

  /* Grown one polygon at a time rather than compared against the largest once: an island
     chain reaches the mainland through its neighbours, and a single pass would drop
     everything past the first hop. */
  const slack = clamp(span * REACH, FINEST, REACH_MAX);
  const kept = [parts[0]];
  let frame = parts[0].box;
  for (let growing = true; growing;) {
    growing = false;
    for (const part of parts) {
      if (kept.includes(part) || !within(frame, part.box, slack)) continue;
      kept.push(part);
      frame = union(frame, part.box);
      growing = true;
    }
  }

  const air = spanOf(frame) * AIR;
  const origin = { x: frame.minX - air, y: frame.minY - air };
  const d = kept
    .map((part) => ringPath(simplify(part.ring, grid * 1.2), origin, grid, places))
    .filter((path) => path !== null)
    .join('');
  if (d === '') return null;

  const round = (n) => Number(n.toFixed(places));
  return {
    d,
    viewBox: `0 0 ${String(round(frame.maxX - frame.minX + air * 2))} ${String(round(frame.maxY - frame.minY + air * 2))}`,
  };
}

/** ISO_A2_EH resolves the codes ISO_A2 leaves at -99 for the disputed and the dependent. */
const isoOf = (properties) =>
  [properties.ISO_A2_EH, properties.ISO_A2].find(
    (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value),
  );

/**
 * POINT OF VIEW.
 *
 * Natural Earth files every contested area more than once: alongside `ADM0_A3` it carries
 * `ADM0_A3_RU`, `ADM0_A3_CN`, `ADM0_A3_US` and thirty more, each saying which country that
 * ground belongs to as far as that state is concerned. They disagree, and the disagreement
 * is the point — Kosovo is `KOS` to Washington and `SRB` to Moscow, Taiwan is `TWN` to most
 * and `CHN` to Beijing, Crimea is `UKR` to nearly everyone and `RUS` to Russia.
 *
 * Set `GEOGLYPH_POV` and the sheet is cut that way: reassigned ground joins the country
 * that viewpoint gives it to, and an entity that viewpoint does not recognise stops having
 * a glyph at all, so it drops out of `CODES` and out of both flag tiers with it.
 *
 * Unset is not a neutral choice, only an inherited one — it is Natural Earth's own default
 * assignment, which is what this package has always shipped.
 */
const POV = process.env.GEOGLYPH_POV?.toUpperCase();

/** Where a feature's land goes under the chosen viewpoint. */
const a3Under = (properties) =>
  (POV === undefined ? undefined : properties[`ADM0_A3_${POV}`]) ?? properties.ADM0_A3;

/**
 * The code a whole admin-0 unit answers to, for the reassignment above. Deliberately not a
 * plain map of every feature: six `ADM0_A3` values cover more than one ISO code — `FRA` is
 * France, Mayotte, Réunion, Martinique, Guadeloupe and French Guiana — so the country's own
 * feature is the one that names it, and its overseas subunits keep their own codes.
 */
function codesByA3(features) {
  const map = new Map();
  for (const { properties } of features) {
    const code = isoOf(properties);
    if (code === undefined) continue;
    const primary = properties.SUBUNIT === properties.ADMIN;
    if (primary || !map.has(properties.ADM0_A3)) map.set(properties.ADM0_A3, code);
  }
  return map;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const raw =
    file === undefined ? await (await fetch(SOURCE)).text() : await readFile(file, 'utf8');
  const geo = JSON.parse(raw);

  const povs = Object.keys(geo.features[0].properties)
    .filter((key) => key.startsWith('ADM0_A3_'))
    .map((key) => key.slice(8));
  if (POV !== undefined && !povs.includes(POV)) {
    throw new Error(`GEOGLYPH_POV=${POV} is not one of: ${povs.join(' ')}`);
  }

  const byA3 = codesByA3(geo.features);

  // Subunits of one country are separate features; a glyph wants the country whole.
  const byCode = new Map();
  const stateless = new Map();
  const reassigned = [];
  for (const feature of geo.features) {
    const properties = feature.properties;
    const moved = a3Under(properties);
    /* Left where it is, it keeps its own code — which is what holds French Guiana apart
       from France. Moved, it becomes part of whoever this viewpoint says holds it.
   
       The fallback is what a viewpoint adds beyond reassignment. With none set the sheet is
       keyed on each feature's own ISO code and ground that has no code of its own simply
       has no home: Crimea is filed under `RUS` with no alpha-2, so it has never been drawn
       in anybody's outline. Choose a viewpoint and that ground is attributed — to `RU`
       under Russia's, to `UA` under everyone else's. */
    const own = isoOf(properties);
    const code =
      moved === properties.ADM0_A3
        ? (own ?? (POV === undefined ? undefined : byA3.get(moved)))
        : byA3.get(moved);
    if (code === undefined) {
      /* This viewpoint grants the ground to an admin-0 unit with no ISO alpha-2 of its
         own — Northern Cyprus to Turkey, Somaliland to Taiwan. There is no code to file a
         glyph under and no honest country to fold it into, so it is left out and said so. */
      const name = properties.ADMIN ?? properties.NAME;
      if (name) stateless.set(name, moved);
      continue;
    }
    if (moved !== properties.ADM0_A3 || own === undefined) {
      reassigned.push(
        `${properties.ADMIN ?? properties.NAME} → ${code} (${properties.ADM0_A3}→${moved})`,
      );
    }
    const rings = ringsOf(feature.geometry);
    byCode.set(code, [...(byCode.get(code) ?? []), ...rings]);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const made = [];
  let bytes = 0;
  for (const [code, rings] of [...byCode].toSorted(([a], [b]) => a.localeCompare(b))) {
    const glyph = glyphOf(rings);
    if (glyph === null) continue;
    const lower = code.toLowerCase();
    await writeFile(
      join(OUT, `${lower}.js`),
      `// ${code} — generated by scripts/build-shapes.mjs. Do not edit.\n` +
        `export const shape = { d: ${quote(glyph.d)}, viewBox: ${quote(glyph.viewBox)} };\n` +
        `export default shape;\n`,
    );
    made.push(code);
    bytes += glyph.d.length;
  }

  /* One declaration for every country rather than 242 identical ones: the `types`
     condition in the exports map has no wildcard in it, so TypeScript reads this file
     for `geoglyph/shape/anything` and the package sheds several hundred files. */
  await writeFile(
    join(root, 'generated', 'shape.d.ts'),
    `import type { Shape } from '../dist/types.js';\n` +
      `export declare const shape: Shape;\nexport default shape;\n`,
  );
  await writeFile(
    join(root, 'generated', 'codes.js'),
    `export const CODES = ${JSON.stringify(made)};\n`,
  );
  await writeFile(
    join(root, 'generated', 'codes.d.ts'),
    `export declare const CODES: readonly string[];\n`,
  );
  await writeFile(
    join(root, 'generated', 'shape-registry.js'),
    `// Generated by scripts/build-shapes.mjs. Do not edit.\nexport const shapes = {\n` +
      made.map((c) => `  ${c}: () => import('./shape/${c.toLowerCase()}.js'),`).join('\n') +
      `\n};\n`,
  );
  await writeFile(
    join(root, 'generated', 'shape-registry.d.ts'),
    `export declare const shapes: Record<\n  string,\n  () => Promise<{ shape: { readonly d: string; readonly viewBox: string } }>\n>;\n`,
  );

  console.log(
    `build-shapes: ${String(made.length)} glyphs, ${String(Math.round(bytes / 1024))}KB of path data` +
      (POV === undefined ? '' : ` — point of view: ${POV}`),
  );
  /* Printed rather than trusted. Every one of these is a claim, and the columns carry the
     odd mistake — `ADM0_A3_AR` files Barbados under Uruguay, which Argentina does not
     think either. A viewpoint you cannot read is a viewpoint you cannot check. */
  if (reassigned.length > 0) {
    console.log(
      `  ${String(reassigned.length)} reassigned: ${[...new Set(reassigned)].join(', ')}`,
    );
  }
  if (stateless.size > 0) {
    console.warn(
      `  no ISO code under this viewpoint, so left out: ` +
        [...stateless].map(([name, a3]) => `${name} (${a3})`).join(', '),
    );
  }
}
