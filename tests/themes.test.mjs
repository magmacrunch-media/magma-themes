// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, DIST_DIR, loadThemes, validate, isTvSafe, tvSafe, tvSignal,
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
