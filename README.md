# magma-themes

The colour themes of magmacrunch.com, kept in one place so the games, apps and
the Wii homebrew can use the same ones the website does.

47 themes, 41 of them with colours: the site's global palette, the visual and
music sections, every archive artist and place, the arcade games that carry
their own themes, and the six arcade pages that only set nav colours.

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

`dist/tv-report.txt` lists the 41 colours that move. They are the electric
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
