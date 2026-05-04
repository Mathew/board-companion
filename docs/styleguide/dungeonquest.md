# DungeonQuest Theme — Style Guide

Source of truth: **DungeonQuest Revised Edition** (FFG, 2014).
Visual reference: `examples/DQ01_RulesReference_web.pdf` — cover + interior pages.

---

## Design Intent

Two distinct zones, each drawn from a different part of the physical product:

| Zone | Source | Feel |
|------|--------|------|
| Header / nav bar | Book cover — dark stone, gold title | Dungeon gate, imposing, theatrical |
| Page + cards | Interior pages — warm cream parchment, dark text | Aged manuscript, readable, tactile |

---

## Color Palette

All values defined as CSS custom properties in `themes/dungeonquest.css`.

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#F5F0E5` | Page background — warm cream parchment |
| `--surface` | `#EDE5C8` | Secondary surfaces: buttons, card inner bg |
| `--surface2` | `#F0EBD8` | Deck card background — slightly warmer parchment |
| `--accent` | `#8B2010` | Blood red — draw button, drawn card name, danger borders |
| `--accent-dim` | `#5A1008` | Deeper red — active/pressed accent state |
| `--text` | `#1E1610` | Dark warm charcoal — all body text on parchment |
| `--text-dim` | `#7A5C3A` | Warm brown — secondary text, counts, labels |
| `--text-invert` | `#F5F0E5` | Parchment — text on dark surfaces (draw btn, header) |
| `--border` | `#C8A870` | Warm gold-tan — card borders, box outlines |
| `--empty` | `#DDD0B0` | Lighter tan — empty deck state |

### Header overrides (not CSS vars — direct values in theme CSS)

| Property | Value | Reason |
|----------|-------|--------|
| `header { background }` | `#1A1008` | Cover's dark stone; `--surface` would be light parchment |
| `header { border-bottom-color }` | `#3A2810` | Slightly lighter stone seam |
| `header h1 { color }` | `#C49028` | Cover's amber-gold title; `--accent` is blood red |

---

## Typography

Both fonts loaded via Google Fonts CDN in `themes/dungeonquest.css`.

### Cinzel — headings (`--font-heading`)

- Weights used: 400 (regular), 600 (semibold), 700 (bold)
- Applied to: `header h1`, `.deck-name`
- Character: Roman inscriptional capitals — evokes carved stone, ancient authority
- Fallback: `'Palatino Linotype', 'Book Antiqua', serif`

### Crimson Text — body (`--font-body`)

- Variants loaded: regular, semibold, italic
- Applied to: `body`, all deck content, counts, card names
- Character: Renaissance oldstyle serif — warm, legible, manuscript-like
- Fallback: `'Georgia', serif`

---

## Surface Hierarchy

Light parchment stack (dark-on-light, interior page model):

```
--bg (#F5F0E5)           ← page / outermost layer
  --surface2 (#F0EBD8)   ← deck cards
    --surface (#EDE5C8)  ← buttons, current-card-area inner bg
```

Exception — header:
```
#1A1008 (direct)         ← header bar (cover-style dark stone)
  #C49028 (direct)       ← h1 title text (cover amber-gold)
  --accent (#8B2010)     ← .btn-danger text/border (blood red, readable on dark)
```

---

## Accent Usage Rules

**Blood red `#8B2010` (`--accent`):**
- Draw button background
- Drawn card name
- `.btn-danger` border + text (full reset)
- Empty deck border tint

**Amber gold `#C49028` (direct, header only):**
- `header h1` title text only
- Not a CSS var — scoped to the header override block

**Never use gold for interactive elements** (buttons, card actions). Gold = identity/title. Red = action/danger.

---

## How to Add a New Game Theme

1. Create `themes/<game-id>.css` — mirror this file's structure:
   - `@import` any web fonts
   - Override `:root` CSS vars
   - Add element overrides for any tokens that the game's design violates (e.g. header background)

2. Create `docs/styleguide/<game-id>.md` — document source material, palette, typography, any override rationale.

3. Add `./themes/<game-id>.css` to `ASSETS` array in `sw.js`.

4. Add game JSON at `games/<game-id>.json` with `"id": "<game-id>"` field — `app.js` uses this to call `applyTheme(id)`.

No changes to `style.css` or `app.js` needed.

---

## Contrast Notes

| Pairing | Ratio (approx) | Pass |
|---------|---------------|------|
| `--text` on `--bg` (`#1E1610` / `#F5F0E5`) | ~13:1 | AAA |
| `--text` on `--surface2` | ~12:1 | AAA |
| `--text-dim` on `--surface2` | ~4.5:1 | AA |
| `--text-invert` on `--accent` (draw btn) | ~5.5:1 | AA |
| `#C49028` on `#1A1008` (header title) | ~6.5:1 | AA |
| `--accent` on `--bg` (danger btn text) | ~5.8:1 | AA |
