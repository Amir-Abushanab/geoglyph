---
"geoglyph": minor
---

Add `REGIONS`, the codes that are not countries, beside `CODES`. `CODES` stays countries
only, so a country picker built from it never shows a region; it changes only by gaining
`FJ`, `KI` and `FM` below. A region loads like any country: `load`, `has`, `loadFlag`,
`loadFlagSvg` and the `shape/`, `flag/` and `flag-px/` subpaths all take one, and each has
its flag from flag-icons in both tiers.

`REGIONS` is `EU` (above) and five more, the blocs drawn like it, as their members each
cropped as its own glyph is and dissolved into one outline:

- `ASEAN`, the Association of Southeast Asian Nations: its 11 member states, Timor-Leste
  included since October 2025.
- `EAC`, the East African Community: its 8 partner states, Somalia and the DR Congo
  included. Somalia is what Natural Earth files under `SO`, so it is drawn without
  Somaliland, as the `SO` glyph is.
- `ARAB`, the League of Arab States: its 22 members, Syria included. Morocco is drawn
  without Western Sahara and Somalia without Somaliland, as their own glyphs are, and
  Palestine as its own glyph is. The Comoros stays though it is far from every other member.
- `PC`, the Pacific Community, standing in for Oceania: Australia, New Zealand and the 22
  Pacific island countries and territories among its 27 members. France, the United Kingdom
  and the United States are members too but are not drawn, or the Pacific would be a speck
  between their mainlands. It is drawn with the date line in the middle, and its members too
  small to see at that scale, Tuvalu to Pitcairn, are dots.

And `UN`, the world, filled with the UN flag: every piece of land in one outline, the ground
no country's code holds included, nothing cropped from it, and Antarctica left out as the UN
emblem leaves it out.

Add `FJ`, `KI` and `FM`, Fiji, Kiribati and Micronesia, to `CODES`: they had no glyph, as
the crop kept nothing of them. Fiji is drawn across the date line, which cuts it in two, and
Kiribati and Micronesia, whose every island is a speck beside the span of their chains, as
their largest island, Kiritimati and Pohnpei. Every other country is unchanged.
