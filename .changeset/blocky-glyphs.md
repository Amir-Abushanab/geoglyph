---
"geoglyph": minor
---

Add `toBlocks(shape, { cells })`: the outline snapped to square cells, `cells` along its longer
side (default 10). It returns a `Shape`, so `toSvg`, `Glyph` and flags take it unchanged. On
the root and in its own entry point, `geoglyph/blocks`, which reaches no registry. The
playground has a Blocks control.
