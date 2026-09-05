---
'geoglyph': minor
---

Clip the flag with an inline `clip-path: path('…')` instead of a `<clipPath>` element
referenced by id. The id was a fingerprint of the outline, so every glyph of a country
shared one declaration, and all of them lost their clip the moment the copy that declared
it stopped being rendered: skipped offscreen by `content-visibility`, or unmounted while a
twin survived. An invalid clip is no clip, so the flag drew as a rectangle over the
country rather than inside it.

The markup is now a pure function of the shape and the options. `clipIdFor` is replaced by
`clipPathFor`, and the `clipId` option is gone from both `toSvg` and `<Glyph>`.
