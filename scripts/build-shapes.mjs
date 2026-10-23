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
import { fileURLToPath, pathToFileURL } from 'node:url';

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
/** How far simplification may move a point, as a multiple of the grid. Over one, because
    a point that moves less than the grid was going to be snapped onto it anyway. */
const SIMPLIFY = 1.2;
/** The same for a shape unioned out of several — see `SHAPE_FROM`. Two copies of one
    shared border, each simplified by up to this much, drift apart by up to twice it, and a
    drift wider than a grid cell outlives the snap: not a ragged border, which would be
    covered by the neighbour either way, but a pinhole in the middle of the country, open
    at every size over about 100px. The arithmetic is a guide; what settles the number is
    that the union rasterises watertight at it, which at 1.2 it does not. */
const SIMPLIFY_UNION = 0.5;
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

/** A vertex as a string, for matching one ring's points against another's exactly. */
const pointKey = ([x, y]) => `${String(x)} ${String(y)}`;

/** Twice the area a ring encloses, signed by which way round it runs. */
const areaOf = (ring) =>
  ring.reduce((sum, [ax, ay], i) => {
    const [bx, by] = ring[(i + 1) % ring.length];
    return sum + ax * by - bx * ay;
  }, 0);

/**
 * Neighbours dissolved into one outline: every border two of them share is dropped, and
 * what is left is stitched back into rings. Natural Earth draws a shared border with the
 * same vertices on both sides, so with every ring turned the same way round it appears
 * once in each direction, and the two cancel exactly.
 *
 * Laying the rings together, as `SHAPE_FROM` does, fills the same ground, and is fine for
 * three small pieces. It is not for twenty-eight countries at the coarsest grid: each copy
 * of a border simplifies on its own, and the drift opens pinholes all along every frontier.
 * Dissolved, there is no second copy to drift from, and none of the frontiers is drawn.
 *
 * Under nonzero fill, any way of chaining the surviving edges into loops fills the same
 * ground, so where three borders meet in a point it does not matter which way the walk
 * turns. Ground no member covers comes out as a ring running the other way — Switzerland
 * is a hole in the Union, and stays one.
 */
function dissolve(rings) {
  /** Unmatched edges, by `from>to`, each a stack in case a border is drawn twice. */
  const open = new Map();
  for (const ring of rings) {
    const closed = pointKey(ring[0]) === pointKey(ring.at(-1)) ? ring.slice(0, -1) : ring;
    const turned = areaOf(closed) < 0 ? closed.toReversed() : closed;
    for (const [i, a] of turned.entries()) {
      const b = turned[(i + 1) % turned.length];
      if (pointKey(a) === pointKey(b)) continue;
      const back = open.get(`${pointKey(b)}>${pointKey(a)}`);
      if (back !== undefined && back.length > 0) {
        back.pop();
        continue;
      }
      const name = `${pointKey(a)}>${pointKey(b)}`;
      open.set(name, [...(open.get(name) ?? []), [a, b]]);
    }
  }
  const leaving = new Map();
  for (const [a, b] of [...open.values()].flat()) {
    const list = leaving.get(pointKey(a)) ?? [];
    list.push([a, b]);
    leaving.set(pointKey(a), list);
  }
  const out = [];
  for (const list of leaving.values()) {
    while (list.length > 0) {
      let edge = list.pop();
      const start = pointKey(edge[0]);
      const ring = [edge[0]];
      /* Every vertex is left as often as it is reached — cancelling a pair takes one of
         each from both ends — so the walk always finds a way on until it is home. */
      while (pointKey(edge[1]) !== start) {
        ring.push(edge[1]);
        edge = leaving.get(pointKey(edge[1])).pop();
      }
      out.push([...ring, ring[0]]);
    }
  }
  return out;
}

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

/**
 * The rings a glyph keeps — specks dropped, then the crop — with the box they make and the
 * span of everything it was given, which is what the grid is sized to. Its own function so
 * that a group (see `GROUPS`) can crop each member exactly as that member's glyph is cropped.
 *
 * `anchors` are vertices whose rings are never specks, however small: in a group, each
 * member's own landmass, so Malta is not dropped from the Union for being Malta-sized. Nor
 * are they ever too far away: a member is in its group wherever it lies, so the Comoros is
 * in the Arab League though no other member is within reach of it.
 */
export function cropOf(rings, anchors = new Set()) {
  if (rings.length === 0) return null;
  const span = spanOf(boxOf(rings.flat()));
  if (span === 0) return null;

  const anchored = (part) => part.ring.some((point) => anchors.has(pointKey(point)));
  /* Specks first: an islet the size of the grid is a rounding artefact, and leaving it in
     lets the crop reach across an ocean through a chain of them. */
  const parts = rings
    .map((ring) => ({ ring, box: boxOf(ring) }))
    .filter((part) => spanOf(part.box) >= span * SPECK || anchored(part))
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
    /* Only once nothing more is in reach, so a group whose every member is reached keeps
       its rings in the order it always has; an anchor taken in here grows the crop on. */
    if (growing) continue;
    for (const part of parts) {
      if (kept.includes(part) || !anchored(part)) continue;
      kept.push(part);
      frame = union(frame, part.box);
      growing = true;
    }
  }
  return { rings: kept.map((part) => part.ring), frame, span };
}

export function glyphOf(rings, smoothing = SIMPLIFY, anchors = new Set()) {
  const crop = cropOf(rings, anchors);
  if (crop === null) return null;
  const { frame, span } = crop;

  const grid = clamp(span / DETAIL, FINEST, COARSEST);
  const places = digits(grid);

  const air = spanOf(frame) * AIR;
  const origin = { x: frame.minX - air, y: frame.minY - air };
  /* An anchor too small to survive simplifying is drawn from its every point instead, which
     at a few grid cells across is still a handful of them. */
  const pathOf = (ring) =>
    ringPath(simplify(ring, grid * smoothing), origin, grid, places) ??
    (ring.some((point) => anchors.has(pointKey(point)))
      ? ringPath(ring, origin, grid, places)
      : null);
  const d = crop.rings
    .map(pathOf)
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

/**
 * EDITORIAL. Codes whose glyph is drawn from more ground than their own feature holds.
 * The counterpart to `FLAG_FROM` in build-flags.mjs, and like it a position rather than a
 * fix — the one place besides that one where the geometry departs from its source on
 * purpose.
 *
 * Natural Earth files this ground as three features — Israel, the West Bank, Gaza — and so
 * makes three marks out of it: an outline with a bite taken out of its middle, a sliver,
 * and a speck the crop then drops for sitting too far from the sliver to count as one
 * landmass with it. Here `IL` and `PS` are both drawn from all three, so both are the whole
 * territory between the river and the sea, and both pour the Palestinian flag into it.
 *
 * A union by laying the rings together rather than a true polygon union: the three are
 * adjacent and not overlapping, so under the default nonzero fill-rule — which is what
 * `clip-path: path(...)` uses too — the shared borders do not draw and what comes out is
 * one silhouette. No clipping library, and the crop below sees one landmass to grow across.
 *
 * It is not hidden anywhere it could be mistaken for a bug: each generated module names
 * what it was drawn from, the build prints it, and the README says so.
 */
const SHAPE_FROM = { IL: ['IL', 'PS'], PS: ['IL', 'PS'] };

/**
 * Codes that are not a country but a union of them: blocs flag-icons draws a flag for, and
 * which people picture as a shape of their own — not as twenty-seven, or eleven.
 *
 * Each member is cropped first, exactly as its own glyph is — France without Réunion,
 * Portugal without the Azores and Madeira, Spain without the Canaries — and what is left is
 * dissolved into one outline (see `dissolve`), so the specks and the crop then run once
 * more at the scale of the whole. That drops Bornholm and most of the Aegean, as it would
 * for any country this size, but never a member: each one's own landmass is an anchor, so
 * Malta stays.
 *
 * Members are whatever the sheet has filed under their codes, so a viewpoint that gives
 * Northern Cyprus to `CY` gives it to the Union too. Each list is the bloc's own, read off
 * its own site in October 2026.
 */
const GROUPS = {
  /* The European Union, whose code ISO 3166 reserves exceptionally: its 27 member states.
     Åland is listed beside Finland: Natural Earth gives it a code of its own, and it is in
     the Union. */
  EU: 'AT AX BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(
    ' ',
  ),
  /* ASEAN, the Association of Southeast Asian Nations: its eleven member states, Timor-Leste
     the eleventh since 26 October 2025 (asean.org/member-states). Indonesia comes whole, as
     its own glyph does, so the eastern edge is Papua's border with Papua New Guinea. */
  ASEAN: 'BN ID KH LA MM MY PH SG TH TL VN'.split(' '),
  /* The East African Community: its eight partner states, the DR Congo in since 2022 and
     Somalia since 2024 (eac.int/eac-partner-states). Somalia is what the sheet files under
     `SO`, so by default without Somaliland, which Natural Earth draws apart and gives no
     code; a viewpoint that gives it to Somalia gives it to the Community too. */
  EAC: 'BI CD KE RW SO SS TZ UG'.split(' '),
  /* The League of Arab States: its 22 members, as the member-states list on the League's own
     portal (lasportal.org) gives them — read through the Internet Archive's copy of March
     2026, the portal itself not answering — with Syria's seat restored since May 2023. As
     with the EAC, Somalia comes without Somaliland and Morocco without Western Sahara, which
     Natural Earth files under `EH`, its own code; and Palestine is drawn as its own glyph is
     (see `SHAPE_FROM`). The Comoros, at the head of the Mozambique Channel and over 1,000 km
     from Somalia, is out of the crop's reach of any other member, and stays because it is
     one (see `cropOf`). */
  ARAB: 'AE BH DJ DZ EG IQ JO KM KW LB LY MA MR OM PS QA SA SD SO SY TN YE'.split(' '),
  /* The Pacific Community, which stands in here for Oceania: Australia, New Zealand and the
     22 Pacific island countries and territories among its 27 members (spc.int/our-members).
     The other three are France, the United Kingdom and the United States, founding members
     for the territories they held in 1947, and they are left out: drawn whole, their
     mainlands would put the Community's outline across half the world and leave the Pacific
     a speck in it; cropped as their own glyphs are, they are Europe and North America and
     not their islands either way. Their territories that are members in their own right —
     New Caledonia, French Polynesia, Wallis and Futuna, Pitcairn, Guam, American Samoa, the
     Northern Marianas — are in.

     It straddles the date line, so it is drawn with the line in the middle (see `DATELINE`),
     and most of its members are islands far smaller than a speck at its scale, so they are
     dots (see `dotted`). */
  PC: 'AS AU CK FJ FM GU KI MH MP NC NR NU NZ PF PG PN PW SB TK TO TV VU WF WS'.split(' '),
};

/**
 * Groups drawn with the date line in the middle rather than at both edges. The projection
 * puts the seam at 180°, which suits every country but the few it cuts in two, and a group
 * of Pacific islands is nothing but those: west of the line from Palau to Tuvalu, east of it
 * from Samoa to Pitcairn. Moving everything west of Greenwich a whole turn east draws them
 * as one ocean, and each member is cropped there too — Fiji included, which in the plain
 * projection is two halves 360° apart and so has no glyph of its own.
 */
const DATELINE = new Set(['PC']);

/** A ring a whole turn east if it lies west of Greenwich. Natural Earth cuts every ring at
    the date line, so none straddles it, and the two halves of one cut meet again at exactly
    360, where `dissolve` closes the seam. */
const eastward = (ring) =>
  ring.every(([x]) => x < 180) ? ring.map(([x, y]) => [x + 360, y]) : ring;

/**
 * Members as a group draws them, for a group that is mostly islands too small to see. Where
 * more than half its members' landmasses are smaller than a speck at the scale of the whole,
 * each of those is a dot a speck across, centred where the member's own landmass is: the
 * smallest island the glyph would keep of its own accord, and how a map of the Pacific
 * marks Tuvalu. Kept true to size they are there in the path and gone at any size it is
 * drawn at, which leaves the Pacific Community as Australia, New Zealand and New Guinea.
 *
 * Only then: the EU has one member that small, Malta, and the Arab League two, and each of
 * them keeps its own outline, which is what an island the size of a speck looks like.
 */
function dotted(crops) {
  const speck = spanOf(boxOf(crops.flatMap((crop) => crop.rings).flat())) * SPECK;
  const small = crops.filter((crop) => spanOf(boxOf(crop.rings[0])) < speck);
  if (small.length * 2 <= crops.length) return crops;
  return crops.map((crop) => {
    if (!small.includes(crop)) return crop;
    const { minX, maxX, minY, maxY } = boxOf(crop.rings[0]);
    const [x, y, r] = [(minX + maxX) / 2, (minY + maxY) / 2, speck / 2];
    const dot = Array.from({ length: 13 }, (_, i) => {
      const turn = ((i % 12) * Math.PI) / 6;
      return [x + r * Math.cos(turn), y + r * Math.sin(turn)];
    });
    return { rings: [dot] };
  });
}

/**
 * The one code drawn as the whole world: `UN`, which flag-icons fills with the United
 * Nations' flag. Every feature on the sheet, dissolved into one outline as a group's members
 * are, with two differences.
 *
 * It is taken from the features, not the codes. The codes leave out ground no viewpoint
 * files under any of them — by default Crimea, Somaliland, Northern Cyprus and the Siachen
 * Glacier — and the world with holes where they are would be taking a side by leaving them
 * blank. Land is land, so this is the same under every viewpoint.
 *
 * And nothing is cropped first: the crop is for telling a country from what it merely owns,
 * and nothing is overseas from the world. Alaska, Hawaii and Réunion all count; what the
 * specks then drop at the scale of the whole — Hawaii and Sri Lanka among it — they would
 * drop from any shape this size.
 *
 * Antarctica is left out, as the UN emblem leaves it out. In this projection it is a band
 * the whole width of the bottom edge, the South Pole stretched as wide as the equator, and
 * the largest ring on the sheet — the one the crop starts from, with no other land within
 * reach of it, so left in, the world comes out as Antarctica alone.
 */
const WORLD = 'UN';

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

/* Run directly, as against imported for `glyphOf`. Compared as URLs, since a path with a
   space in it is percent-encoded on one side and not the other. */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
  /* Every ring on the sheet bar Antarctica's, wherever any viewpoint files it (see `WORLD`). */
  const land = [];
  for (const feature of geo.features) {
    const properties = feature.properties;
    if (properties.ADM0_A3 !== 'ATA') land.push(...ringsOf(feature.geometry));
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

  /* Applied to the finished sheet rather than while it is being read, so a union takes in
     whatever the viewpoint above has already filed under each code, and so a code that
     viewpoint does not draw at all is not brought back to life by being named here. Read
     from a snapshot, so two codes drawn from each other get the same rings once each. */
  const before = new Map(byCode);
  const combined = [];
  for (const [code, from] of Object.entries(SHAPE_FROM)) {
    if (!before.has(code)) continue;
    byCode.set(
      code,
      from.flatMap((part) => before.get(part) ?? []),
    );
    combined.push(`${code} ← ${from.join('+')}`);
  }

  /* After the table above, from the sheet as it now stands. Each member as its own glyph
     crops it; a member this viewpoint does not draw is simply not there. */
  const anchorsOf = new Map();
  for (const [code, members] of Object.entries(GROUPS)) {
    const sheetOf = (member) =>
      (byCode.get(member) ?? []).map((ring) => (DATELINE.has(code) ? eastward(ring) : ring));
    /* A member whose own crop keeps nothing is its largest island. That is Micronesia and
       Kiribati, which have no glyph of their own: every island in each is a speck beside
       the span of its chain. */
    const largestOf = (rings) =>
      rings.length === 0
        ? null
        : { rings: [rings.toSorted((a, b) => spanOf(boxOf(b)) - spanOf(boxOf(a)))[0]] };
    const crops = dotted(
      members
        .map((member) => cropOf(sheetOf(member)) ?? largestOf(sheetOf(member)))
        .filter(Boolean),
    );
    const rings = dissolve(crops.flatMap((crop) => crop.rings));
    if (rings.length === 0) continue;
    byCode.set(code, rings);
    /* A member's largest ring is the first its crop keeps; one vertex of it is enough to
       find it again after the dissolve, which rebuilds every ring. */
    anchorsOf.set(code, new Set(crops.map((crop) => pointKey(crop.rings[0][0]))));
    combined.push(`${code} ← ${members.join('+')}`);
  }
  byCode.set(WORLD, dissolve(land));
  combined.push(`${WORLD} ← the world but Antarctica`);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const made = [];
  let bytes = 0;
  for (const [code, rings] of [...byCode].toSorted(([a], [b]) => a.localeCompare(b))) {
    const from = SHAPE_FROM[code];
    const members = GROUPS[code];
    /* A group is simplified like any country: dissolved, it has no second copy of a border
       to drift from. */
    const glyph = glyphOf(
      rings,
      from === undefined ? SIMPLIFY : SIMPLIFY_UNION,
      anchorsOf.get(code),
    );
    if (glyph === null) continue;
    const source =
      from !== undefined
        ? `${from.join('+')} combined (see SHAPE_FROM), `
        : members !== undefined
          ? `${members.join('+')} dissolved (see GROUPS), `
          : code === WORLD
            ? `every feature but Antarctica dissolved (see WORLD), `
            : '';
    const lower = code.toLowerCase();
    await writeFile(
      join(OUT, `${lower}.js`),
      `// ${code} — ${source}generated by scripts/build-shapes.mjs. Do not edit.\n` +
        `export const shape = { d: ${quote(glyph.d)}, viewBox: ${quote(glyph.viewBox)} };\n` +
        `export default shape;\n`,
    );
    made.push(code);
    bytes += glyph.d.length;
  }

  /* One declaration for every country rather than 248 identical ones: the `types`
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
  if (combined.length > 0) console.log(`  combined: ${combined.join(', ')}`);
  if (stateless.size > 0) {
    console.warn(
      `  no ISO code under this viewpoint, so left out: ` +
        [...stateless].map(([name, a3]) => `${name} (${a3})`).join(', '),
    );
  }
}
