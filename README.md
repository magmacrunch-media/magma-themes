# magma-themes

The colour themes of magmacrunch.com, kept in one place so the games, apps and
the Wii homebrew can use the same ones the website does.

84 themes, 78 of them with colours: the site's global palette, the visual and
music sections, every archive artist and place, the arcade games that carry
their own themes, and the six arcade pages that only set nav colours.
Sixteen are this repo's own, not the website's: light versions of the
Global Palette, Pop Art, Memphis, City Pop and American Spirit, three game
themes, six one-hue archive themes, Volcano and EMERAC.

## Naming

A theme is named for what it looks like, not for the page that uses it,
because a page can change its look and its old colours should not go with
it. The page that uses a theme is its `web` block, and that is the part
that moves:

- **A page gets a new look.** The new theme takes the `web` block. The old
  one loses it, gains `"wasUsedBy": [{ "file": ..., "until": "YYYY-MM-DD" }]`,
  and stays here for anything else to use.
- **An artist or place changes its cover.** The plain slug (`dino-spumoni`)
  always means the current look. The old theme is renamed for its era, such
  as `dino-spumoni-<album>`, before the new one takes the plain slug.
- **A theme is renamed.** Its old slug goes in `aliases`, so a saved
  setting, a `data-magma-theme` attribute or a C macro written against it
  keeps working. Aliases are not listed in pickers.

`ultraviolet` and `deep-cyan` were `label-purple` and `contributor-cyan`
until 2026-10-20, and both old slugs still work. They are the first of the
`mono` family: one hue in steps from near black to pale. `family` is
optional, and the families are listed in `tools/lib.mjs`. A test holds
every `mono` theme to one hue.

`ember`, `orchid` and `gold` are the by-artist, by-place and by-label
archive indexes. Each is ultraviolet's saturation and
lightness at another hue (14, 314 and 45 degrees), on the neutral
`#0a0a0c` those pages share. They have no `web` block because those pages
set the colours inline over `contributor-theme.css` rather than in a file
of their own, so an edit to one of them is made in the page and copied
here by hand.

The four label pages under `archive/by-label/` each set a theme inline over
`label-theme.css`, the same arrangement one level down. `ink`, `phosphor`
and `crimson` are magmacrunch music, magmacrunch arcade and The Slop
Collective, at 222, 135 and 350 degrees, keeping ultraviolet's hue-tinted
ground.

`volcano` is magmacrunch media, the root label, and is deliberately not
`mono`: the record label is the homepage, so it wears the homepage's
colours from `global-palette` (its `basedOn`), the one page in the section
with more than one hue. Each of `label-theme.css`'s ten steps takes the
`style.css` colour that does the same job on the homepage: black ground,
cyan nav line, rose title, lava for the ticker and hover.

The by-label index draws each label's card from these four, so a change to
one is three edits: the page, its card on the index, and the theme here.
`ultraviolet` is still `label-theme.css`'s own default, which is why it
keeps its `web` block, but no label page shows it any more.

`emerac` is the archive's own main page, `archive/index.html`, named for
the mock database console at its centre: mint phosphor, an amber frame and
ticker, red and gold LEDs, on the indexes' `#0a0a0c`. Mint is 167 degrees,
clear of the three indexes it leads to, and its frame and nav greens are
ultraviolet's steps at that hue. It is set inline in the page rather than
in `archive.css`, which the artist subpages load too.

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
