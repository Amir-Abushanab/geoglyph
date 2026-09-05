---
'geoglyph': minor
---

A flag now replaces the silhouette instead of being drawn over it. `backdrop` opts the
silhouette back in.

A fill and a clipped image with the same edge do not add up to one edge: at a boundary
pixel with coverage `a` the fill contributes `a(1-a)`, a quarter of it at the halfway
point, so the silhouette showed as a hairline around every flagged glyph, in both tiers,
at every size, in every engine. On Andorra at 300px that was about 200 pixels of it.
Clipping a group instead, or isolating one, measures identical; only not painting the fill
removes it.

Pass `backdrop: true` for the two cases that want something underneath: a `flag` given as a
URL rather than a data URI, and a CSS hover fade, which needs the flag to fade onto the
shape rather than onto the page.
