---
'geoglyph': minor
---

Ship `llms.txt`, a flat API reference for coding agents. It carries the entry points,
`toSvg` options, `Glyph` props, working examples, the flag tiers and all 242 codes, plus
the mistakes that are easy to make against this package: subpath imports are lowercase
while `load` and `has` are not, `loadFlag` lives on `geoglyph/flags` rather than
`geoglyph`, `flag` is a string, and a CSS hover fade needs `backdrop: true` to land on the
shape.

It is in the tarball and at the root of the playground site, so it is reachable from
`node_modules` without the network. `pnpm llms` regenerates it from `package.json`, the
type definitions and `CODES`; `pnpm check` fails if it is stale or if `SvgOptions` gained
an option it does not document.
