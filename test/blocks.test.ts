import assert from 'node:assert/strict';
import test from 'node:test';
import { CODES, load, toBlocks, toSvg } from '../dist/index.js';
import { clipPathFor } from '../dist/svg.js';
/* Through the package's own name, the entry point a consumer who wants only this imports. */
import { toBlocks as fromSubpath } from 'geoglyph/blocks';
import brShape from 'geoglyph/shape/br';

/** The cells a blocky path fills, as `x,y` keys. */
function cellsOf(d: string): Set<string> {
  const out = new Set<string>();
  for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
    for (let dy = 0; dy < Number(h); dy += 1) {
      for (let dx = 0; dx < Number(w); dx += 1)
        out.add(`${String(Number(x) + dx)},${String(Number(y) + dy)}`);
    }
  }
  return out;
}

test('a solid square is every cell, drawn as one rectangle', () => {
  const blocks = toBlocks({ d: 'M0 0h4v4h-4z', viewBox: '0 0 4 4' }, { cells: 4 });
  assert.equal(blocks.viewBox, '0 0 4 4');
  assert.equal(blocks.d, 'M0 0h4v4h-4z');
});

test('the longer side gets the cells, and the shorter keeps the aspect', () => {
  const blocks = toBlocks({ d: 'M0 0h8v2h-8z', viewBox: '0 0 8 2' }, { cells: 8 });
  assert.equal(blocks.viewBox, '0 0 8 2');
  assert.equal(cellsOf(blocks.d).size, 16);
});

test('a hole in the outline stays a hole', () => {
  // Wound against the outer ring, which is how the nonzero rule `toSvg` fills with cuts one.
  const blocks = toBlocks({ d: 'M0 0h6v6h-6zM2 2v2h2v-2z', viewBox: '0 0 6 6' }, { cells: 6 });
  const cells = cellsOf(blocks.d);
  for (const inside of ['2,2', '3,2', '2,3', '3,3'])
    assert.ok(!cells.has(inside), `${inside} filled`);
  assert.equal(cells.size, 32);
});

test('an island too small to fill a cell still keeps one', () => {
  // A quarter of a cell: under the fill threshold, but a landmass rather than a speck.
  const blocks = toBlocks(
    { d: 'M0 0h6v6h-6zM8.6 8.6h.5v.5h-.5z', viewBox: '0 0 10 10' },
    { cells: 10 },
  );
  assert.ok(cellsOf(blocks.d).has('8,8'), 'the island fell through the grid');
});

test('every country draws at least one cell, inside its own box', async () => {
  for (const code of CODES) {
    const shape = await load(code);
    assert.ok(shape !== null);
    const blocks = toBlocks(shape);
    const [, , cols = 0, rows = 0] = blocks.viewBox.split(' ').map(Number);
    assert.equal(Math.max(cols, rows), 10, `${code} is ${blocks.viewBox}`);
    assert.match(blocks.d, /^(?:M\d+ \d+h\d+v\d+h-\d+z)+$/, `${code} path is not rectangles`);
    for (const cell of cellsOf(blocks.d)) {
      const [x = -1, y = -1] = cell.split(',').map(Number);
      assert.ok(x < cols && y < rows, `${code} fills ${cell} outside ${blocks.viewBox}`);
    }
  }
});

test('it is a shape: the same input gives the same path, and toSvg takes it', () => {
  assert.equal(toBlocks(brShape, { cells: 12 }).d, toBlocks(brShape, { cells: 12 }).d);
  assert.equal(fromSubpath(brShape).d, toBlocks(brShape).d);
  const blocks = toBlocks(brShape);
  assert.ok(toSvg(blocks).includes(`viewBox="${blocks.viewBox}"`));
  assert.ok(clipPathFor(blocks).startsWith("path('M"));
});
