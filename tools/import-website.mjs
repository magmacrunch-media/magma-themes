// Split the website's arcade/admin/themes.json into one source file per theme.
//
//   node tools/import-website.mjs <path to website checkout> [--force]
//
// This seeded the repo on 2026-10-17 and is kept so the seeding can be
// reproduced, not as a sync. Once a theme is edited here, this repo is the
// source and the website's file is generated FROM it (dist/themes.json), so a
// second import would overwrite those edits. It refuses unless --force.
//
// Roles are GUESSED here and say so: `rolesFrom: "import-heuristic"`. A human
// who checks a theme's roles changes that to "hand". The guess is
//   bg     the darkest palette entry
//   text   the entry with the most contrast against bg
//   accent nav.accent when it is one of the palette's own colours, which it
//          usually is, otherwise the most saturated entry that is not bg/text

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES_DIR, luminance, contrast, hexToRgb } from './lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const site = args.find((a) => !a.startsWith('--'));
if (!site) {
  console.error('usage: node tools/import-website.mjs <website checkout> [--force]');
  process.exit(2);
}
const src = join(site, 'arcade', 'admin', 'themes.json');
if (!existsSync(src)) {
  console.error(`no themes.json at ${src}`);
  process.exit(2);
}
const existing = readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json'));
if (existing.length && !force) {
  console.error(`themes/ already holds ${existing.length} file(s); this repo is the source now.`);
  console.error('Re-importing would overwrite edits made here. Pass --force if that is intended.');
  process.exit(1);
}

const slugify = (s) =>
  s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function saturation(hex) {
  const [r, g, b] = hexToRgb(hex);
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
}

// A palette entry whose own name says what it is beats any colour maths, so
// the names are tried first. Matched on the name with the section prefix
// stripped, so `--svfp-bg` and the George Boole themes' bare `bg` both match.
const HINTS = {
  bg: [/^bg$/, /^background$/, /^black$/, /^bg-dark$/],
  surface: [/^surface$/, /^panel$/, /^bg-light$/, /^deep$/, /^card$/],
  text: [/^text$/, /^ink$/, /^fg$/, /^white$/, /^cream$/],
  muted: [/^muted$/, /^dim$/, /^text-dim$/],
  accent: [/^accent$/, /^primary$/],
  accent2: [/^accent-?2$/, /^secondary$/],
};

function hinted(pal, prefix, role) {
  const bare = (v) => v.replace(/^--/, '').replace(prefix ? new RegExp(`^${prefix}-`) : /^$/, '');
  for (const re of HINTS[role]) {
    const hit = pal.find((p) => re.test(bare(p.var)));
    if (hit) return hit;
  }
  return null;
}

function guessRoles(t) {
  const pal = t.palette;
  if (!pal.length) return {};
  const bg = hinted(pal, t.prefix, 'bg') ||
    pal.reduce((a, p) => (luminance(p.value) < luminance(a.value) ? p : a));
  const text = hinted(pal, t.prefix, 'text') ||
    pal.reduce((a, p) => (contrast(p.value, bg.value) > contrast(a.value, bg.value) ? p : a));
  const roles = { bg: bg.var, text: text.var };
  for (const role of ['surface', 'muted', 'accent2']) {
    const hit = hinted(pal, t.prefix, role);
    if (hit && hit.var !== bg.var && hit.var !== text.var) roles[role] = hit.var;
  }
  const named = hinted(pal, t.prefix, 'accent');
  if (named) {
    roles.accent = named.var;
    return roles;
  }
  const navAccent = (t.nav && t.nav.accent || '').toLowerCase();
  let accent = pal.find((p) => p.value.toLowerCase() === navAccent && p.var !== bg.var);
  if (!accent) {
    const rest = pal.filter((p) => p.var !== bg.var && p.var !== text.var);
    if (rest.length) accent = rest.reduce((a, p) => (saturation(p.value) > saturation(a.value) ? p : a));
  }
  if (accent) roles.accent = accent.var;
  return roles;
}

const site_themes = JSON.parse(readFileSync(src, 'utf8'));
const order = [];
for (const t of site_themes) {
  const slug = slugify(t.name);
  if (order.includes(slug)) throw new Error(`two themes slugify to ${slug}`);
  order.push(slug);
  // Everything the website file carries survives, so dist/themes.json can
  // reproduce it byte for byte. `web` holds the fields only the site reads.
  const web = { section: t.section, bodyClass: t.bodyClass, prefix: t.prefix, file: t.file };
  if ('dataTheme' in t) web.dataTheme = t.dataTheme;
  web.nav = t.nav;
  const out = {
    name: t.name,
    palette: t.palette,
    roles: guessRoles(t),
    rolesFrom: 'import-heuristic',
    web,
  };
  const known = new Set(['name', 'section', 'bodyClass', 'prefix', 'file', 'dataTheme', 'palette', 'nav']);
  const extra = Object.keys(t).filter((k) => !known.has(k));
  if (extra.length) throw new Error(`${t.name}: fields the importer does not know: ${extra.join(', ')}`);
  writeFileSync(join(THEMES_DIR, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
}
writeFileSync(
  join(THEMES_DIR, 'index.json'),
  JSON.stringify({ order }, null, 2) + '\n',
);
console.log(`imported ${order.length} themes from ${src}`);
