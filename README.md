# magma-themes

The colour themes of magmacrunch.com, kept in one place so the games, apps and
the Wii homebrew can use the same ones the website does.

58 themes, 52 of them with colours: the site's global palette, the visual and
music sections, every archive artist and place, the arcade games that carry
their own themes, and the six arcade pages that only set nav colours. Eight
are this repo's own, not the website's: light versions of the Global Palette,
Pop Art, Memphis, City Pop and American Spirit, and three game themes.

## Game themes

`moonlight-drift`, `caldera` and `french-tarot` are each game's colours read
off its own CSS and canvas code, for things that should look like the game
without being it: the game's page under `ware/` on the website, first. The
games do not read them back, so a game that changes its look needs its theme
changed here by hand. They have no `web` block for the same reason the light
themes do not: the website's theme manager writes a `web` theme back into the
file it names, and these games keep their colours as literals rather than as
variables it could write.

## Light themes

The website is dark almost everywhere, so only Dorfic was light. The five
`-light` themes fill that out for apps with a light mode. Each is drawn from
its `basedOn` theme's palette, with a few deeper shades added where a colour
was too pale to read on a light background, and the tests hold them to
contrast: text at least 7:1 on `bg`, `muted` at least 4.5:1, both accents at
least 3:1. They have no `web` block, so `dist/themes.json`, the website's
copy, leaves them out. A theme is light when its `bg` is lighter than its
`text`.

## Using it

`dist/` is committed, so nothing needs building to consume it.

**A web page:**

```html
<link rel="stylesheet" href="themes.css">
<body data-magma-theme="memphis">
  <h1 style="color: var(--mt-accent, #fff)">...</h1>
```

**JavaScript:**

```js
import { THEMES, applyTheme } from './themes.mjs';
applyTheme('city-pop');            // sets every --mt-* on <html>
THEMES['city-pop'].roles.bg;       // '#...'
```

**C, for magnolia and GRRLIB on the Wii:**

```c
#include "magma_themes.h"
GRRLIB_FillScreen(MT_GLOBAL_PALETTE_BG_TV);
GRRLIB_Printf(x, y, font, MT_GLOBAL_PALETTE_ACCENT_TV, 1, "MAGMACRUNCH");
```

Colours are `0xRRGGBBAA`. Prefer the `_TV` form on a console; see below.

## Roles

Every theme maps what it can onto six shared roles, so a game can ask any
theme for a background without knowing what that theme calls its colours:

| role | meaning |
|---|---|
| `bg` | page or screen background |
| `surface` | a panel or card on top of `bg` |
| `text` | body text, readable on `bg` |
| `muted` | secondary text |
| `accent` | the theme's signature colour |
| `accent2` | a second accent, where the theme has one |

A theme need not fill all six. **The roles were assigned by a heuristic on
import** (palette names first, then the darkest colour for `bg`, the highest
contrast for `text`, and the site's nav accent for `accent`), and every theme
says so with `"rolesFrom": "import-heuristic"`. When a theme's roles have been
checked by eye, change that to `"hand"`.

## TV safety

The Wii's composite output can't carry very saturated bright colours cleanly:
past about 110 IRE a CRT bleeds and blooms. So every colour also gets a `_TV`
form in the C header, pulled toward grey at the same brightness until it is
within limits. A colour that was already safe is unchanged, so defaulting to
`_TV` costs nothing.

`dist/tv-report.txt` lists the 51 colours that move. They are the electric
cyans, yellows and greens. The site's rose, `#ff3d6e`, is fine.

## Editing

The sources are `themes/<slug>.json`, ordered by `themes/index.json`.

```bash
node tools/build.mjs            # regenerate dist/
node tools/build.mjs --check    # what CI runs: fails if dist/ is stale
node --test tests/themes.test.mjs
```

The website takes its themes from here: its `arcade/admin/themes.json` is a
copy of `dist/themes.json`, synced by its `npm run sync:themes` and checked
against this repo's `main` in its CI.

## Licence

All rights reserved; see `LICENSE`. Public so that the website and the public
games can read it without credentials, not as an offer of reuse.
