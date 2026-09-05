---
'geoglyph': minor
---

The sheet can be cut to a point of view. Natural Earth carries 33 per-country columns
saying who holds each contested area, and `GEOGLYPH_POV` picks one:

```sh
GEOGLYPH_POV=UA pnpm vendor    # Crimea in Ukraine, no Kosovo
GEOGLYPH_POV=RU pnpm vendor    # Crimea in Russia, Kosovo in Serbia, Taiwan in China
```

Reassigned ground joins the country that viewpoint gives it to. An entity it does not
recognise loses its glyph, its code and both its flags, so `RU` ships 240 countries and
`MA` 239. A viewpoint also attributes ground that has no ISO code of its own, which is why
Crimea is in nobody's outline until you choose one. The build prints every reassignment,
since the upstream columns carry the occasional mistake.

Leaving it unset is unchanged in every byte, and uses Natural Earth's default assignment.
