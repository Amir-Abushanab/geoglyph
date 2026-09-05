/*
 * The playground, driven entirely by the built package: `/dist/index.js` and the
 * generated registries are imported here exactly as a consumer would import them, so a
 * change to `toSvg` shows up on screen and a change to the crop shows up in the grid.
 *
 * One thing is deliberately not re-rendered. `size` and `fill` are pushed to the page as
 * custom properties instead of re-serialising 242 outlines on every frame of a slider
 * drag. That is not a cheat: both land on a presentation attribute, which sits below any
 * stylesheet in the cascade, so the pixels are the same ones the same values passed to
 * `toSvg` would produce. The detail panel does call `toSvg` with the real settings, and
 * that is the markup it shows you.
 */
import { CODES, load, toSvg } from './dist/index.js';
import { flagHref } from './dist/svg.js';
import { loadFlag } from './dist/flags.js';
import { loadFlagSvg } from './dist/flags-svg.js';

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const detail = $('detail');
const body = $('detail-body');
const form = $('settings');

const escapeText = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttr = (value) => escapeText(value).replaceAll('"', '&quot;');

const bytes = (n) => (n < 1024 ? `${String(n)} B` : `${(n / 1024).toFixed(n < 102400 ? 1 : 0)} KB`);
/** Data URIs are ASCII; SVG source is not, so measure it the way a server would. */
const encoder = new TextEncoder();
const sizeOf = (text) => encoder.encode(text).length;

/*
 * Editorial overrides, and they live here rather than in `generated/` on purpose. The
 * package keys everything to ISO 3166-1 alpha-2 and says in as many words that it takes no
 * position it did not inherit; `generated/flag/il.js` is untouched and still returns what
 * flag-icons ships, so anyone installing geoglyph sees no part of this. What it costs is
 * that for these codes the page is no longer showing you what `toSvg` over the real
 * modules produces — for `IL` it is showing a different flag under a different name.
 *
 * To carry this to consumers it would have to move into `scripts/build-flags.mjs`, where it
 * would survive `pnpm vendor`, and the README's line about inheriting its positions would
 * have to go.
 */
const RENAMED = { IL: 'Occupied Palestine' };

/* The package ships codes, not names — the browser already has the table. */
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const nameOf = (code) => {
  if (code in RENAMED) return RENAMED[code];
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};

/* ---- data ---------------------------------------------------------------- */

const shapes = new Map();
const flagsByTier = { raster: new Map(), vector: new Map() };
const loaderByTier = { raster: loadFlag, vector: loadFlagSvg };

async function flagsFor(tier) {
  const cache = flagsByTier[tier];
  if (cache.size === 0) {
    const get = loaderByTier[tier];
    await Promise.all(
      CODES.map(async (code) => {
        const flag = await get(code);
        if (flag !== null) cache.set(code, flag);
      }),
    );
  }
  return cache;
}

/* ---- settings ------------------------------------------------------------ */

const settings = () => ({
  draw: $('draw').value,
  tier: $('tier').value,
  size: $('size').value.trim() || '1em',
  fill: $('fill').value.trim() || 'currentColor',
  className: $('className').value.trim() || 'geoglyph',
  bg: $('bg').value.trim(),
  titled: $('titled').checked,
  backdrop: $('backdrop').checked,
  hover: $('hover').checked,
  /* A list, so you can compose a set rather than find one thing: `br, jp, cl` is three
     countries, and a stray comma or a half-typed term is nothing rather than everything. */
  terms: $('filter')
    .value.toLowerCase()
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term !== ''),
  sort: $('sort').value,
});

/** The options object `toSvg` would be handed, built the way a caller would build it. */
function optionsFor(code, current, flag) {
  const options = { size: current.size, fill: current.fill, className: current.className };
  if (flag !== undefined) options.flag = flag;
  /* The hover recipe fades the flag out, so it needs the silhouette to fade onto — turning
     it on with the checkbox is also the way to see the rim `backdrop` costs you. */
  if (current.backdrop || current.hover) options.backdrop = true;
  if (current.titled) options.title = nameOf(code);
  return options;
}

/** Typed values reach CSS, so a half-finished one must not blank the page. */
function checked(input, property, value, fallback) {
  const ok = CSS.supports(property, value);
  input.setAttribute('aria-invalid', ok ? 'false' : 'true');
  return ok ? value : fallback;
}

function applyLive() {
  const current = settings();
  const style = document.documentElement.style;
  style.setProperty('--glyph-size', checked($('size'), 'width', current.size, '48px'));
  style.setProperty('--glyph-fill', checked($('fill'), 'fill', current.fill, 'currentColor'));
  style.setProperty('--flag-opacity', current.hover ? '0' : '1');
  /* Empty means transparent — the glyph over whatever the page already is, which is the
     honest default. Anything else is a backdrop to hold it against, which is how you catch
     a rim that is neither the flag's colour nor the page's. */
  if (current.bg === '') {
    style.removeProperty('--glyph-bg');
    $('bg').setAttribute('aria-invalid', 'false');
  } else {
    style.setProperty('--glyph-bg', checked($('bg'), 'color', current.bg, 'transparent'));
  }
  adviseOnTier(current);
}

/** The raster tier's own resolution. Past it, the browser is inventing pixels — and that,
    rather than any rounder number, is where the advice starts. */
const RASTER_WIDE = 48;

/**
 * `size` can be any CSS length, so the threshold is measured rather than parsed: a hidden
 * probe carries the same `--glyph-size` and reports what it came to in pixels.
 */
function adviseOnTier(current) {
  const wide = $('probe').getBoundingClientRect().width;
  const showing = current.draw !== 'shape' && current.tier === 'raster' && wide > RASTER_WIDE;
  $('advice').hidden = !showing;
  if (!showing) return;
  $('advice-text').innerHTML =
    `Drawn at <b>${String(Math.round(wide))}px</b> from a <b>${String(RASTER_WIDE)}×36</b> raster` +
    ` — use the vector tier.`;
}

/* ---- rendering ----------------------------------------------------------- */

function artFor(code, current, flag) {
  if (current.draw === 'raw') {
    return flag === undefined
      ? '<span class="missing">no flag</span>'
      : `<img class="flag" src="${escapeAttr(flagHref(flag))}" alt="">`;
  }
  const shape = shapes.get(code);
  return toSvg(shape, optionsFor(code, current, current.draw === 'flag' ? flag : undefined));
}

function visible(current) {
  /* Any term, not every term — a list of countries is a union, not an intersection.
     A two-letter term is a code and is matched as one: every alpha-2 is a substring of
     some country's name, so `br, jp, cl` would otherwise hand you Brunei, Brazzaville and
     the British Virgin Islands alongside the three you named. Three letters or more is a
     search again, so `bra` still finds both Brazils. */
  const hit = (code, term) =>
    term.length === 2
      ? code.toLowerCase() === term
      : code.toLowerCase().includes(term) || nameOf(code).toLowerCase().includes(term);
  const matches = (code) =>
    current.terms.length === 0 || current.terms.some((term) => hit(code, term));
  const codes = CODES.filter(matches);
  if (current.sort === 'name') return codes.toSorted((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (current.sort === 'bytes')
    return codes.toSorted((a, b) => shapes.get(b).d.length - shapes.get(a).d.length);
  return codes;
}

/* Rendering is async — the flag tier may still be arriving — so a fast hand on the
   controls can have two of these in flight. Only the newest is allowed to write. */
let generation = 0;

async function render() {
  const mine = ++generation;
  const current = settings();
  grid.setAttribute('aria-busy', 'true');

  const flags = current.draw === 'shape' ? null : await flagsFor(current.tier);
  if (mine !== generation) return;

  const codes = visible(current);
  grid.innerHTML =
    codes.length === 0
      ? '<p class="loading">Nothing matches.</p>'
      : codes
          .map(
            (code) =>
              `<button class="cell" type="button" data-code="${code}">` +
              `<span class="art">${artFor(code, current, flags?.get(code))}</span>` +
              `<span class="code">${code}</span>` +
              `<span class="name">${escapeText(nameOf(code))}</span>` +
              `</button>`,
          )
          .join('');
  grid.setAttribute('aria-busy', 'false');

  renderSpecimen(current, flags, codes);

  /* What importing this selection costs, as the addition it actually is — the two tiers
     are separate modules, so a page that draws flags pays for both. */
  const pathBytes = codes.reduce((total, code) => total + shapes.get(code).d.length, 0);
  const flagBytes =
    flags === null ? 0 : codes.reduce((total, code) => total + sizeOf(flags.get(code) ?? ''), 0);
  $('count').innerHTML =
    `${String(codes.length)} of ${String(CODES.length)} · ` +
    (flags === null
      ? `<b>${bytes(pathBytes)}</b> of outlines`
      : `${bytes(pathBytes)} outlines + ${bytes(flagBytes)} ${current.tier} flags ` +
        `= <b>${bytes(pathBytes + flagBytes)}</b>`);

  adviseOnTier(current);
}

/* A control group for the claim in the title: whatever the size control says, this line
   is always 1em, set in running text. */
const SPECIMEN = ['PS', 'ES', 'NO', 'YE'].filter((code) => CODES.includes(code));
/** Past this it stops being a sentence and starts being the grid again. */
const SPECIMEN_MAX = 8;

function renderSpecimen(current, flags, codes) {
  /* Unfiltered, a fixed cast, so the line stays comparable as you turn the other knobs.
     Filtered, it follows the filter — the question "what does this look like in running
     text" is worth asking of the country you went looking for, not of Brazil. Sorted the
     way the grid is, so `bytes` puts the heaviest of your matches in the sentence. */
  const cast = current.terms.length === 0 ? SPECIMEN : codes.slice(0, SPECIMEN_MAX);
  show(document.querySelector('.specimen'), cast.length > 0);
  if (cast.length === 0) return;

  const one = (code) => {
    const flag = current.draw === 'shape' ? undefined : flags?.get(code);
    const options = optionsFor(code, current, flag);
    options.size = '1em';
    return `${toSvg(shapes.get(code), options)}&nbsp;${escapeText(nameOf(code))}`;
  };
  const rest = codes.length - cast.length;
  $('specimen').innerHTML =
    `Set in a sentence — ${cast.map(one).join(', ')} — ` +
    (cast.length === 1
      ? 'a mark the height of the letters beside it.'
      : 'each one is a mark the height of the letters beside it.') +
    (current.terms.length > 0 && rest > 0
      ? ` <span class="rest">${String(rest)} more in the grid.</span>`
      : '');
}

/* ---- detail -------------------------------------------------------------- */

let sources = {};

async function openDetail(code) {
  const current = settings();
  const shape = shapes.get(code);
  const lower = code.toLowerCase();
  const [raster, vector] = await Promise.all([loadFlag(code), loadFlagSvg(code)]);
  const flag = (current.tier === 'vector' ? vector : raster) ?? undefined;

  const options = optionsFor(code, current, current.draw === 'shape' ? undefined : flag);
  const markup = toSvg(shape, options);
  /* `options.flag`, not `flag` — the flag is loaded either way, but only counted when the
     current draw mode actually put it in the markup. */
  const flagBytes = options.flag === undefined ? 0 : sizeOf(flagHref(options.flag));

  /* The flag is a data URI or 177 KB of Serbian eagle; neither belongs in a snippet you
     are meant to read, so it goes back to being the identifier it was imported as. */
  const call =
    `toSvg(shape, {\n` +
    Object.entries(options)
      .map(([key, value]) => (key === 'flag' ? `  flag,` : `  ${key}: ${JSON.stringify(value)},`))
      .join('\n') +
    `\n});`;

  const imports = [
    `import shape from 'geoglyph/shape/${lower}';`,
    ...(options.flag === undefined
      ? []
      : [
          current.tier === 'vector'
            ? `import flag from 'geoglyph/flag/${lower}';`
            : `import flag from 'geoglyph/flag-px/${lower}';`,
        ]),
    `import { toSvg } from 'geoglyph/svg';`,
  ].join('\n');

  sources = { imports, call, markup };

  /* These countries are also in the grid below, at another size, inside cells the browser
     skips while they are offscreen. That used to matter — a shared clip id meant the
     survivor drew its flag as a rectangle — and the point of the inline clip is that it
     no longer does. Nothing here has to be kept apart from anything. */
  const preview = (withFlag) =>
    toSvg(shape, {
      size: '120px',
      fill: current.fill,
      ...(withFlag && flag !== undefined ? { flag } : {}),
    });

  body.innerHTML = `
    <div class="detail-head">
      <div class="previews">
        <figure>${preview(false)}<figcaption>outline</figcaption></figure>
        ${flag === undefined ? '' : `<figure>${preview(true)}<figcaption>flag poured in</figcaption></figure>`}
      </div>
      <div>
        <h2>${escapeText(nameOf(code))}</h2>
        <p class="code">${code}</p>
      </div>
    </div>
    <ul class="facts">
      <li>viewBox <b>${escapeText(shape.viewBox)}</b></li>
      <li>markup <b>${bytes(sizeOf(markup) - flagBytes)}</b>${flagBytes === 0 ? '' : ' + the flag'}</li>
    </ul>
    <table class="costs">
      <caption>What importing ${code} costs</caption>
      <tbody>
        <tr><th>outline alone</th><td>${bytes(shape.d.length)}</td><td></td></tr>
        ${tierRow('+ raster flag', shape, raster)}
        ${tierRow('+ vector flag', shape, vector)}
      </tbody>
    </table>
    ${snippet('imports', 'Import')}
    ${snippet('call', 'Call, at your current settings')}
    ${snippet('markup', 'Markup it returns')}
  `;
  detail.showPopover();
}

/** One tier as an addition, so the total is arrived at rather than asserted. */
const tierRow = (label, shape, flag) =>
  flag === null
    ? `<tr><th>${label}</th><td>—</td><td></td></tr>`
    : `<tr><th>${label}</th><td>${bytes(sizeOf(flag))}</td>` +
      `<td>= <b>${bytes(shape.d.length + sizeOf(flag))}</b></td></tr>`;

const snippet = (key, label) => `
  <div class="snippet">
    <div class="snippet-head">
      <span>${label}</span>
      <button type="button" class="ghost" data-copy="${key}">Copy</button>
    </div>
    <pre class="mono">${escapeText(sources[key])}</pre>
  </div>`;

/* ---- wiring -------------------------------------------------------------- */

grid.addEventListener('click', (event) => {
  const cell = event.target.closest('.cell');
  if (cell !== null) void openDetail(cell.dataset.code);
});

detail.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (button === null) return;
  await navigator.clipboard.writeText(sources[button.dataset.copy]);
  button.textContent = 'Copied';
  setTimeout(() => {
    button.textContent = 'Copy';
  }, 1200);
});

/** Structural changes rebuild the grid; a keystroke in the filter should not do that 242
    times on the way to a word. */
let queued;
const rerender = () => {
  clearTimeout(queued);
  queued = setTimeout(() => void render(), 120);
};

form.addEventListener('input', (event) => {
  const id = event.target.id;
  if (id === 'sizeRange') $('size').value = `${$('sizeRange').value}px`;
  if (id === 'fillPicker') $('fill').value = $('fillPicker').value;
  if (id === 'size') {
    const px = Number.parseFloat($('size').value);
    if (Number.isFinite(px) && $('size').value.trim().endsWith('px'))
      $('sizeRange').value = String(px);
  }
  if (id === 'fill' && /^#[0-9a-f]{6}$/i.test($('fill').value.trim())) {
    $('fillPicker').value = $('fill').value.trim();
  }
  if (id === 'bgPicker') $('bg').value = $('bgPicker').value;
  if (id === 'bg' && /^#[0-9a-f]{6}$/i.test($('bg').value.trim())) {
    $('bgPicker').value = $('bg').value.trim();
  }

  applyLive();
  /* size, fill and hover are already on screen by now; the rest change the markup. */
  if (id === 'hover') rerender(); // backdrop follows it, and that is markup
  if (!['size', 'sizeRange', 'fill', 'fillPicker', 'hover', 'bg', 'bgPicker'].includes(id))
    rerender();
});
form.addEventListener('submit', (event) => event.preventDefault());

/* The colour input has no empty state of its own, so getting back to transparent needs a
   control rather than a value. */
$('bgClear').addEventListener('click', () => {
  $('bg').value = '';
  $('bg').dispatchEvent(new Event('input', { bubbles: true }));
});

$('advice-fix').addEventListener('click', () => {
  $('tier').value = 'vector';
  $('tier').dispatchEvent(new Event('input', { bubbles: true }));
});

const show = (element, on) => {
  if (on) element.removeAttribute('hidden');
  else element.setAttribute('hidden', '');
};

/* Two states, per the usual advice: the system setting, and one pinned scheme. */
const meta = document.querySelector('meta[name="color-scheme"]');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const button = $('scheme');

function applyScheme(pinned) {
  if (pinned === null) {
    delete document.documentElement.dataset.scheme;
    meta.content = 'light dark';
    localStorage.removeItem('geoglyph:scheme');
  } else {
    document.documentElement.dataset.scheme = pinned;
    meta.content = pinned;
    localStorage.setItem('geoglyph:scheme', pinned);
  }
  /* The button shows what clicking it gives you, so the icon is the scheme you are not in.
     With the label gone the name has to come from somewhere: aria-label is that somewhere. */
  const showing = pinned ?? (systemDark.matches ? 'dark' : 'light');
  const toLight = showing === 'dark';
  /* `hidden` is a property of HTMLElement, and these are SVGElements — assigning `.hidden`
     on one sets a expando nobody reads and shows both icons at once. The attribute is not
     fussy about which namespace it lands in, and neither is the `[hidden]` rule. */
  show(button.querySelector('.sun'), toLight);
  show(button.querySelector('.moon'), !toLight);
  button.setAttribute('aria-label', toLight ? 'Switch to light' : 'Switch to dark');
}

button.addEventListener('click', () => {
  const pinned = document.documentElement.dataset.scheme;
  applyScheme(pinned === undefined ? (systemDark.matches ? 'light' : 'dark') : null);
});
systemDark.addEventListener('change', () => {
  if (document.documentElement.dataset.scheme === undefined) applyScheme(null);
});
applyScheme(document.documentElement.dataset.scheme ?? null);

/* ---- go ------------------------------------------------------------------ */

await Promise.all(
  CODES.map(async (code) => {
    const shape = await load(code);
    if (shape !== null) shapes.set(code, shape);
  }),
);

applyLive();
await render();
