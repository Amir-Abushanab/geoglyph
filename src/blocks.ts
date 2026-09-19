/**
 * Every country in blocks: the same outline, snapped to a grid of square cells.
 *
 * A pure function from one `Shape` to another, so the result goes anywhere a shape does —
 * `toSvg`, `Glyph`, a flag poured inside. The grid is sized to the shape's longer side, so at
 * one rendered size every country is drawn in cells of one size, which is what makes a row of
 * them read as one alphabet rather than a set of thumbnails.
 *
 * Its own entry point, like the loaders: nothing here reaches a registry, and a build that
 * never calls it never carries it.
 */
import type { Shape } from './types.js';

export interface BlockOptions {
  /** Cells along the shape's longer side. Defaults to 10. */
  readonly cells?: number;
}

type Point = readonly [number, number];
type Ring = readonly Point[];

/*
 * The share of a cell the outline has to cover for the cell to be drawn.
 *
 * Under half on purpose. At 0.5 a country a cell wide falls through the grid, since it rarely
 * covers half of any one cell: Chile drew as a speck and Norway as a stub. A third keeps them,
 * and a blob a little fatter than the outline is the right way for a glyph this small to err.
 */
const FILL = 0.3;

/* Scanlines per cell. Coverage is exact along x and sampled along y, so this is the only
   approximation; eight rows put a cell's reading within an eighth of the truth. */
const LINES = 8;

/* An island smaller than this share of a cell is left to the grid rather than promised a
   cell of its own, or every archipelago would draw as a spray of dots. */
const SPECK = 0.02;

export function toBlocks(shape: Shape, options: BlockOptions = {}): Shape {
  const cells = Math.max(1, Math.round(options.cells ?? 10));
  const [, , w = 0, h = 0] = shape.viewBox.split(' ').map(Number);
  const rings = parse(shape.d);

  const side = Math.max(w, h) / cells;
  const cols = Math.max(1, Math.round(w / side));
  const rows = Math.max(1, Math.round(h / side));
  const grid = { cols, rows, cw: w / cols, ch: h / rows };

  const covered = coverage(rings, grid);
  const filled = Array.from(covered, (share) => share >= FILL);
  keepIslands(rings, grid, filled);

  return { d: trace(filled, cols, rows), viewBox: `0 0 ${String(cols)} ${String(rows)}` };
}

interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** A cell's width and height in the shape's own units. */
  readonly cw: number;
  readonly ch: number;
}

/** Path data to rings of absolute points. Covers what the build writes: M, L, H, V, Z. */
function parse(d: string): Ring[] {
  const tokens = d.match(/[MLHVZmlhvz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const rings: Point[][] = [];
  let ring: Point[] | null = null;
  let command = 'M';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const moveTo = (nx: number, ny: number): void => {
    x = nx;
    y = ny;
    startX = nx;
    startY = ny;
    ring = [[x, y]];
    rings.push(ring);
  };
  // A line straight after a `z` starts a new ring at the point the last one closed on.
  const lineTo = (nx: number, ny: number): void => {
    if (ring === null) moveTo(x, y);
    x = nx;
    y = ny;
    ring?.push([x, y]);
  };

  for (let i = 0; i < tokens.length;) {
    const token = tokens[i] ?? '';
    if (/[a-z]/i.test(token)) {
      command = token;
      i += 1;
      if (command === 'Z' || command === 'z') {
        ring = null;
        x = startX;
        y = startY;
      }
      continue;
    }
    const a = Number(token);
    const b = Number(tokens[i + 1]);
    switch (command) {
      case 'M':
        moveTo(a, b);
        command = 'L'; // Pairs after a move are lines, in the move's own case.
        i += 2;
        break;
      case 'm':
        moveTo(x + a, y + b);
        command = 'l';
        i += 2;
        break;
      case 'L':
        lineTo(a, b);
        i += 2;
        break;
      case 'l':
        lineTo(x + a, y + b);
        i += 2;
        break;
      case 'H':
        lineTo(a, y);
        i += 1;
        break;
      case 'h':
        lineTo(x + a, y);
        i += 1;
        break;
      case 'V':
        lineTo(x, a);
        i += 1;
        break;
      case 'v':
        lineTo(x, y + a);
        i += 1;
        break;
      default:
        i += 1;
    }
  }
  return rings.filter((points) => points.length > 2);
}

/**
 * How much of each cell the rings cover, 0 to 1, row by row.
 *
 * By scanline under the nonzero rule, which is the rule `toSvg` fills with, so a hole the
 * outline draws stays a hole in the grid.
 */
function coverage(rings: readonly Ring[], grid: Grid): Float64Array {
  const { cols, rows, cw, ch } = grid;
  const out = new Float64Array(cols * rows);
  const crossings: Array<readonly [number, number]> = [];

  for (let line = 0; line < rows * LINES; line += 1) {
    const y = ((line + 0.5) * ch) / LINES;
    crossings.length = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 1) {
        const [x1, y1] = ring[i] ?? [0, 0];
        const [x2, y2] = ring[(i + 1) % ring.length] ?? [0, 0];
        if (y1 <= y && y < y2) crossings.push([x1 + ((y - y1) * (x2 - x1)) / (y2 - y1), 1]);
        else if (y2 <= y && y < y1) crossings.push([x1 + ((y - y1) * (x2 - x1)) / (y2 - y1), -1]);
      }
    }
    crossings.sort((p, q) => p[0] - q[0]);

    const row = Math.floor(line / LINES);
    let winding = 0;
    for (let i = 0; i < crossings.length - 1; i += 1) {
      winding += crossings[i]?.[1] ?? 0;
      if (winding === 0) continue;
      const from = crossings[i]?.[0] ?? 0;
      const to = crossings[i + 1]?.[0] ?? 0;
      // The span, dealt out to the columns it crosses.
      for (let col = Math.max(0, Math.floor(from / cw)); col < cols && col * cw < to; col += 1) {
        const overlap = Math.min(to, (col + 1) * cw) - Math.max(from, col * cw);
        if (overlap > 0)
          out[row * cols + col] = (out[row * cols + col] ?? 0) + overlap / cw / LINES;
      }
    }
  }
  return out;
}

/**
 * Every island big enough to matter keeps at least one cell.
 *
 * A threshold alone lets a country's second landmass fall between cells — Corsica, the South
 * Island, half of Japan. An island that drew nothing gets the one cell it covers most. Holes
 * are rings wound against the largest one, and are skipped: promising a lake a cell would
 * paint it back in.
 */
function keepIslands(rings: readonly Ring[], grid: Grid, filled: boolean[]): void {
  const areas = rings.map(signedArea);
  const largest = areas.reduce(
    (best, area, i) => (Math.abs(area) > Math.abs(areas[best] ?? 0) ? i : best),
    0,
  );
  const outward = Math.sign(areas[largest] ?? 1);
  const speck = grid.cw * grid.ch * SPECK;

  rings.forEach((ring, i) => {
    const area = areas[i] ?? 0;
    if (Math.sign(area) !== outward) return;
    if (i !== largest && Math.abs(area) < speck) return;
    const own = coverage([ring], grid);
    let best = -1;
    for (let cell = 0; cell < own.length; cell += 1) {
      if ((own[cell] ?? 0) > 0 && filled[cell] === true) return;
      if (best < 0 || (own[cell] ?? 0) > (own[best] ?? 0)) best = cell;
    }
    if (best >= 0 && (own[best] ?? 0) > 0) filled[best] = true;
  });
}

function signedArea(ring: Ring): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] ?? [0, 0];
    const [x2, y2] = ring[(i + 1) % ring.length] ?? [0, 0];
    twice += x1 * y2 - x2 * y1;
  }
  return twice / 2;
}

/**
 * Filled cells to path data: each row's runs, merged downward while the run below them is the
 * same one, so a solid block is one rectangle rather than a stack of them. One path, so cells
 * that touch have no seam between them.
 */
function trace(filled: readonly boolean[], cols: number, rows: number): string {
  interface Rect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    h: number;
  }
  const open = new Map<string, Rect>();
  const done: Rect[] = [];

  for (let y = 0; y < rows; y += 1) {
    const here = new Set<string>();
    for (let x = 0; x < cols;) {
      if (filled[y * cols + x] !== true) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < cols && filled[y * cols + end] === true) end += 1;
      const key = `${String(x)}:${String(end)}`;
      const rect = open.get(key);
      if (rect === undefined) open.set(key, { x, y, w: end - x, h: 1 });
      else rect.h += 1;
      here.add(key);
      x = end;
    }
    for (const [key, rect] of open) {
      if (here.has(key)) continue;
      done.push(rect);
      open.delete(key);
    }
  }
  done.push(...open.values());

  return done
    .toSorted((a, b) => a.y - b.y || a.x - b.x)
    .map((r) => `M${String(r.x)} ${String(r.y)}h${String(r.w)}v${String(r.h)}h-${String(r.w)}z`)
    .join('');
}
