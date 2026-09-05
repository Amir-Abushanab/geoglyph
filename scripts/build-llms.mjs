/**
 * `llms.txt`, for a coding agent that has to call this package correctly.
 *
 * Not the TanStack shape. That one is an index, because their docs are too large to hand
 * an agent whole; this package has one README and eight entry points, so an index over it
 * would be a file with one link in it. This is the flat form the spec allows for small
 * projects: signatures, the traps, and the code list, with none of the rationale that
 * fills the README and none of which helps write a working call.
 *
 * Generated from `package.json`, the type definitions and `CODES`, and it asserts that the
 * options it documents are the options the types declare. Add an option and forget to run
 * this and the build says so rather than shipping a reference that quietly omits it.
 *
 *   node scripts/build-llms.mjs            # write it
 *   node scripts/build-llms.mjs --check    # fail if it is stale
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFile(join(root, ...parts), 'utf8');

const pkg = JSON.parse(await read('package.json'));
const { CODES } = await import(join(root, 'generated', 'codes.js'));

/* The options as the types actually declare them, so this file cannot drift from them. */
const optionsIn = (source, block) => {
  const body = source.slice(source.indexOf(block));
  const end = body.indexOf('\n}');
  return [...body.slice(0, end).matchAll(/^\s{2}(?:readonly )?(\w+)\??:/gm)].map((m) => m[1]);
};
const svgOptions = optionsIn(await read('src', 'types.ts'), 'interface SvgOptions');
const glyphProps = optionsIn(await read('src', 'react.ts'), 'interface GlyphProps');

/* Documented here, checked against the source above. */
const DOCUMENTED = {
  size: '`string | number`, default `1em`. A number is treated as px.',
  fill: '`string`, default `currentColor`. Painted on the silhouette.',
  className: '`string`, default `geoglyph`. Goes on the `<svg>`.',
  flag: '`string`. A URL, a data URI, or raw `<svg>` source. Not an object.',
  backdrop: '`boolean`, default `false`. Paints the silhouette under the flag.',
  title: '`string`. Sets `role="img"` and the accessible name. Omitted, the svg is `aria-hidden`.',
};

const missing = svgOptions.filter((o) => !(o in DOCUMENTED));
const extra = Object.keys(DOCUMENTED).filter((o) => !svgOptions.includes(o));
if (missing.length > 0 || extra.length > 0) {
  throw new Error(
    `llms.txt is out of step with SvgOptions.` +
      (missing.length > 0 ? ` Undocumented: ${missing.join(', ')}.` : '') +
      (extra.length > 0 ? ` No longer an option: ${extra.join(', ')}.` : ''),
  );
}

const entries = Object.keys(pkg.exports).filter((k) => k !== './package.json');

const text = `# geoglyph

> Every country as an SVG outline the size of a letter, with its flag to pour inside.
> ${String(CODES.length)} countries, ISO 3166-1 alpha-2. ESM only, no runtime dependencies.

Playground: https://amir-abushanab.github.io/geoglyph/
Version: ${pkg.version}

## Entry points

${entries.map((e) => `- \`${e.replace('.', 'geoglyph')}\``).join('\n')}

\`geoglyph\` exports \`load\`, \`has\`, \`CODES\`, \`toSvg\`.
\`geoglyph/svg\` exports \`toSvg\`, \`clipPathFor\`, \`flagHref\`.
\`geoglyph/react\` exports \`Glyph\`.
\`geoglyph/flags\` exports \`loadFlag\`. \`geoglyph/flags-svg\` exports \`loadFlagSvg\`.

## Get this right

- Subpath imports are lowercase: \`geoglyph/shape/br\`, not \`/BR\`.
  \`load\`, \`has\`, \`loadFlag\` and \`loadFlagSvg\` take either case.
- \`loadFlag\` is NOT on \`geoglyph\`. It is on \`geoglyph/flags\`, and \`loadFlagSvg\` is on
  \`geoglyph/flags-svg\`. Three entry points, so a build that draws only silhouettes does
  not emit flag chunks.
- \`flag\` is a string, not an object. Pass the default export of \`geoglyph/flag-px/<iso>\`.
- \`toSvg\` returns a string of SVG markup, not an element.
- \`<Glyph>\` takes \`shape\`, not a country code. It fetches nothing.
- \`load\` and \`loadFlag\` return \`null\` for an unknown code. \`has(iso)\` checks first.
- A flag replaces the silhouette. If you fade the flag out with CSS, pass
  \`backdrop: true\` or it fades onto the page instead of onto the shape.

## toSvg(shape, options)

${svgOptions.map((o) => `- \`${o}\` ${DOCUMENTED[o]}`).join('\n')}

## Glyph props

\`${glyphProps.join('`, `')}\`, plus anything else valid on an \`<svg>\`
(\`style\`, \`onClick\`, \`data-*\`, \`ref\`).

## Static import, when the country is known at build time

\`\`\`js
import shape from 'geoglyph/shape/cl';   // { d, viewBox }
import flag from 'geoglyph/flag-px/cl';  // 48x36 png data uri, ~640 B
import { toSvg } from 'geoglyph/svg';

toSvg(shape, { flag, size: '1.5em', title: 'Chile' });
\`\`\`

## Dynamic, when it is not

\`\`\`js
import { load, has } from 'geoglyph';
import { loadFlag } from 'geoglyph/flags';

if (has(code)) {
  const shape = await load(code);
  const flag = await loadFlag(code);
  return toSvg(shape, { flag });
}
\`\`\`

## React

\`\`\`jsx
import { Glyph } from 'geoglyph/react';
import shape from 'geoglyph/shape/br';
import flag from 'geoglyph/flag-px/br';

<Glyph shape={shape} flag={flag} size="1.5em" title="Brazil" />
\`\`\`

## Flag tiers

- \`geoglyph/flag-px/<iso>\` is a 48x36 png data uri, ~640 B whatever the country. Use it
  when the flag fills a silhouette. Above about 48px it visibly softens.
- \`geoglyph/flag/<iso>\` is SVG source. Scales to anything, median 804 B, but uneven:
  Serbia is 177 KB.

## Codes

${CODES.join(' ')}
`;

const out = join(root, 'llms.txt');
if (process.argv.includes('--check')) {
  const current = await readFile(out, 'utf8').catch(() => '');
  if (current !== text) {
    throw new Error('llms.txt is stale. Run `pnpm llms`.');
  }
  console.log('build-llms: llms.txt is current');
} else {
  await writeFile(out, text);
  console.log(
    `build-llms: ${String(Math.round(text.length / 1024))}KB, ${String(svgOptions.length)} options, ` +
      `${String(CODES.length)} codes -> llms.txt`,
  );
}
