---
"geoglyph": minor
---

Draw `IL` and `PS` as one outline: Israel, the West Bank and Gaza laid together as a single
landmass, the whole territory between the river and the sea, filed under both codes and
poured full of the Palestinian flag. Natural Earth carries that ground as three features
and so made three marks out of it — a country with a bite out of its middle, a sliver, and
a speck the crop dropped. The table is `SHAPE_FROM` in `scripts/build-shapes.mjs`, the
counterpart to the flag substitution already in `FLAG_FROM`, and the README says what both
are doing.

A shape unioned out of several rings is also simplified at half a grid cell rather than
1.2, because two copies of one shared border simplified independently drift apart and the
gap survives grid snapping as a pinhole in the middle of the country. Only combined shapes
are affected; every other glyph is byte-identical.
