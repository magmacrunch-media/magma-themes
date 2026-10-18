// Shared colour maths and loading for the importer, the builder and the tests.
// No dependencies, on purpose: anything that can run node can build this repo.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const THEMES_DIR = join(ROOT, 'themes');
export const DIST_DIR = join(ROOT, 'dist');

// The shared roles a consumer can ask any theme for. A theme maps each one it
// has onto one of its own palette entries; a theme need not have all of them.
export const ROLES = ['bg', 'surface', 'text', 'muted', 'accent', 'accent2'];

export const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// WCAG relative luminance, for picking a readable text colour against a bg.
export function luminance(hex) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---- NTSC composite safety -------------------------------------------------
//
// The Wii's composite output encodes each pixel as luma plus a chroma
// subcarrier, and the peak of that signal is Y + C. Saturated brights such as
// the website's rose push it past what a CRT handles cleanly, and the result
// is bleed and bloom that the same hex never shows on a monitor.
//
// Y, I and Q from gamma-encoded RGB in [0, 1], which is what the encoder sees.
// 1.0 is 100 IRE. The 110 IRE peak and -20 IRE trough are the usual
// "broadcast safe" limits; they are conservative rather than a property of any
// particular television, which is the right side to err on.

export const TV_PEAK = 1.1;
export const TV_TROUGH = -0.2;

function yiq([r, g, b]) {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    0.596 * r - 0.274 * g - 0.322 * b,
    0.211 * r - 0.523 * g + 0.312 * b,
  ];
}

export function tvSignal(hex) {
  const [y, i, q] = yiq(hexToRgb(hex).map((v) => v / 255));
  const c = Math.hypot(i, q);
  return { y, c, peak: y + c, trough: y - c };
}

export function isTvSafe(hex) {
  const s = tvSignal(hex);
  return s.peak <= TV_PEAK + 1e-9 && s.trough >= TV_TROUGH - 1e-9;
}

// Pull a colour toward the grey of its own luma until it is safe. Keeping Y
// fixed keeps the brightness the eye reads; only saturation is given up.
// Bisection on the mix factor, then the result is re-checked after rounding to
// 8 bits, since rounding can step back over the line.
export function tvSafe(hex) {
  if (isTvSafe(hex)) return hex.toLowerCase();
  const rgb = hexToRgb(hex);
  const y = tvSignal(hex).y * 255;
  const mix = (t) => rgb.map((v) => Math.round(y + (v - y) * t));
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (isTvSafe(rgbToHex(mix(mid)))) lo = mid;
    else hi = mid;
  }
  let t = lo;
  while (t > 0 && !isTvSafe(rgbToHex(mix(t)))) t -= 0.001;
  return rgbToHex(mix(Math.max(t, 0)));
}

// ---- loading ---------------------------------------------------------------

export function loadThemes() {
  const index = JSON.parse(readFileSync(join(THEMES_DIR, 'index.json'), 'utf8'));
  const onDisk = readdirSync(THEMES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => f.slice(0, -5));
  const listed = new Set(index.order);
  const unlisted = onDisk.filter((s) => !listed.has(s));
  if (unlisted.length) {
    throw new Error(`theme files not in themes/index.json: ${unlisted.join(', ')}`);
  }
  return index.order.map((slug) => {
    const t = JSON.parse(readFileSync(join(THEMES_DIR, `${slug}.json`), 'utf8'));
    return { slug, ...t };
  });
}

// Every problem, not the first one, so a bad import is fixed in one pass.
export function validate(themes) {
  const errors = [];
  const slugs = new Set();
  for (const t of themes) {
    const where = `themes/${t.slug}.json`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug)) errors.push(`${where}: slug is not kebab-case`);
    if (slugs.has(t.slug)) errors.push(`${where}: duplicate slug`);
    slugs.add(t.slug);
    if (typeof t.name !== 'string' || !t.name) errors.push(`${where}: missing name`);
    if (!Array.isArray(t.palette)) {
      errors.push(`${where}: palette is not an array`);
      continue;
    }
    const vars = new Set();
    for (const p of t.palette) {
      if (!HEX6.test(p.value)) errors.push(`${where}: ${p.var} = ${p.value} is not #rrggbb`);
      if (vars.has(p.var)) errors.push(`${where}: ${p.var} appears twice`);
      vars.add(p.var);
    }
    if ('basedOn' in t && !themes.some((o) => o.slug === t.basedOn && o !== t)) {
      errors.push(`${where}: basedOn names ${t.basedOn}, which is not a theme`);
    }
    if (!t.web && t.rolesFrom !== 'hand') errors.push(`${where}: a theme of this repo's own has no import to guess from; its roles must be "hand"`);
    for (const [role, v] of Object.entries(t.roles || {})) {
      if (!ROLES.includes(role)) errors.push(`${where}: unknown role ${role}`);
      if (!vars.has(v)) errors.push(`${where}: role ${role} names ${v}, which is not in the palette`);
    }
  }
  return errors;
}

export function colourOf(theme, varName) {
  return theme.palette.find((p) => p.var === varName).value;
}
