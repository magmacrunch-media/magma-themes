// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, DIST_DIR, loadThemes, validate, isTvSafe, tvSafe, tvSignal, contrast, luminance, colourOf, bare,
} from '../tools/lib.mjs';

const themes = loadThemes();

test('every theme source validates', () => {
  assert.deepEqual(validate(themes), []);
  assert.ok(themes.length >= 40, `only ${themes.length} themes loaded; the loader is suspect`);
});

test('every _TV colour in the header is TV safe, and every safe colour is unchanged', () => {
  const h = readFileSync(join(DIST_DIR, 'magma_themes.h'), 'utf8');
  const defs = new Map([...h.matchAll(/#define (\w+) 0x([0-9a-f]{6})ffu/g)].map((m) => [m[1], `#${m[2]}`]));
  let tv = 0;
  for (const [name, hex] of defs) {
    if (!name.endsWith('_TV')) continue;
    tv++;
    assert.ok(isTvSafe(hex), `${name} = ${hex} is not TV safe`);
    const plain = defs.get(name.slice(0, -3));
    if (isTvSafe(plain)) assert.equal(hex, plain, `${name} moved a colour that was already safe`);
  }
  assert.ok(tv > 500, `only ${tv} _TV macros found; the regex or the header is broken`);
});

test('tvSafe keeps luma and only gives up saturation', () => {
  for (const hex of ['#00f5ff', '#ffe03a', '#39ff6e', '#ff00ff', '#0000ff']) {
    const out = tvSafe(hex);
    assert.ok(isTvSafe(out), `${hex} -> ${out} still unsafe`);
    assert.ok(Math.abs(tvSignal(out).y - tvSignal(hex).y) < 0.01, `${hex} -> ${out} changed brightness`);
  }
  assert.equal(tvSafe('#080808'), '#080808');
});

test('the CSS has a block for every theme with colours', () => {
  const css = readFileSync(join(DIST_DIR, 'themes.css'), 'utf8');
  for (const t of themes.filter((x) => x.palette.length)) {
    assert.ok(css.includes(`[data-magma-theme="${t.slug}"]`), `no CSS block for ${t.slug}`);
  }
});

test('the ES module loads and matches the sources', async () => {
  const { THEMES, ROLES } = await import('../dist/themes.mjs');
  assert.ok(ROLES.includes('bg'));
  assert.equal(Object.keys(THEMES).length, themes.filter((x) => x.palette.length).length);
  assert.equal(THEMES['global-palette'].roles.bg, '#080808');
});

test('dist/ is current', () => {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'build.mjs'), '--check'], { stdio: 'pipe' });
});

// Every light theme's text, muted and accent must read on its bg: a light
// page is where an accent made for a dark one disappears (Dorfic's amber
// was 1.7:1). Text 7:1, muted WCAG AA, accent 3:1.
test('every light theme reads on its background', () => {
  const light = themes.filter((t) => t.roles && t.roles.bg && t.roles.text
    && luminance(colourOf(t, t.roles.bg)) > luminance(colourOf(t, t.roles.text)));
  assert.ok(light.length >= 6, `only ${light.length} light themes`);
  for (const t of light) {
    const c = (r) => contrast(colourOf(t, t.roles.bg), colourOf(t, t.roles[r]));
    assert.ok(c('text') >= 7, `${t.slug}: text is ${c('text').toFixed(2)}:1`);
    assert.ok(c('muted') >= 4.5, `${t.slug}: muted is ${c('muted').toFixed(2)}:1`);
    assert.ok(c('accent') >= 3, `${t.slug}: accent is ${c('accent').toFixed(2)}:1`);
  }
});

// The light themes made here, not imported, are held to more: all six roles,
// and accent2 too.
test("every light theme of this repo's own has all six roles, readable on its background", () => {
  const light = themes.filter((t) => !t.web && t.roles && t.roles.bg && t.roles.text
    && luminance(colourOf(t, t.roles.bg)) > luminance(colourOf(t, t.roles.text)));
  assert.ok(light.length >= 5, `only ${light.length} light themes of this repo's own`);
  for (const t of light) {
    const c = (r) => contrast(colourOf(t, t.roles.bg), colourOf(t, t.roles[r]));
    for (const r of ['bg', 'surface', 'text', 'muted', 'accent', 'accent2']) assert.ok(t.roles[r], `${t.slug} has no ${r}`);
    assert.ok(c('text') >= 7, `${t.slug}: text is ${c('text').toFixed(2)}:1`);
    assert.ok(c('muted') >= 4.5, `${t.slug}: muted is ${c('muted').toFixed(2)}:1`);
    for (const r of ['accent', 'accent2']) assert.ok(c(r) >= 3, `${t.slug}: ${r} is ${c(r).toFixed(2)}:1`);
    assert.ok(c('surface') < 1.5, `${t.slug}: surface should sit close to bg`);
  }
});

// A rename must not break anybody holding the old slug: a saved setting, a
// data-magma-theme attribute, a C macro. Each output answers to it.
test('a renamed theme answers to its old slug in every output', async () => {
  const renamed = themes.filter((t) => (t.aliases || []).length);
  assert.ok(renamed.length >= 2, `only ${renamed.length} renamed themes`);
  const { THEMES, ALIASES } = await import('../dist/themes.mjs');
  const css = readFileSync(join(DIST_DIR, 'themes.css'), 'utf8');
  const h = readFileSync(join(DIST_DIR, 'magma_themes.h'), 'utf8');
  const cid = (s) => s.toUpperCase().replace(/-/g, '_');
  for (const t of renamed) {
    for (const a of t.aliases) {
      assert.equal(ALIASES[a], t.slug);
      assert.equal(THEMES[a], THEMES[t.slug], `THEMES['${a}'] is not ${t.slug}`);
      assert.ok(!Object.keys(THEMES).includes(a), `${a} is enumerable, so a picker lists ${t.slug} twice`);
      assert.ok(css.includes(`[data-magma-theme="${a}"]`), `no CSS selector for ${a}`);
      assert.ok(h.includes(`#define MT_${cid(a)}_BG MT_${cid(t.slug)}_BG\n`), `no C alias for ${a}`);
    }
  }
});

// Taking a theme off its page (deleting `web`) must not rename its generated
// colours, which is what the top-level prefix is for.
test('a theme keeps its generated names when no page uses it any more', () => {
  const ready = themes.filter((x) => x.web && x.prefix);
  assert.ok(ready.length >= 2, `only ${ready.length} themes carry a top-level prefix`);
  for (const t of ready) {
    const { web, ...unbound } = t;
    for (const p of t.palette) assert.equal(bare(unbound, p.var), bare(t, p.var), `${t.slug}: ${p.var} would be renamed`);
  }
});

// `mono` means one hue in steps, so hold it to that: every coloured step
// within 12 degrees of the theme's accent. A neutral void (by-artist's
// #0a0a0c, say) has no hue worth measuring and is skipped.
test('every mono theme is one hue', () => {
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
    if (d / (1 - Math.abs(M + m - 1) || 1) < 0.3) return null;
    const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const mono = themes.filter((t) => t.family === 'mono');
  assert.ok(mono.length >= 5, `only ${mono.length} mono themes`);
  for (const t of mono) {
    const h0 = hue(colourOf(t, t.roles.accent));
    for (const p of t.palette) {
      const h = hue(p.value);
      if (h === null) continue;
      const off = Math.min(Math.abs(h - h0), 360 - Math.abs(h - h0));
      assert.ok(off <= 12, `${t.slug}: ${p.var} ${p.value} is ${off.toFixed(0)} degrees off its accent`);
    }
  }
});

test("the website's copy leaves out the themes it does not have", () => {
  const site = JSON.parse(readFileSync(join(DIST_DIR, 'themes.json'), 'utf8'));
  assert.deepEqual(site.map((t) => t.name), themes.filter((t) => t.web).map((t) => t.name));
});
