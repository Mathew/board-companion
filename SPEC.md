# SPEC.md

## §G — Goal

PWA companion app for DungeonQuest board game. Manage card decks: configure contents, shuffle, draw, track discards, reset. State in localStorage. Mobile-first. GitHub Pages, no backend.

## §C — Constraints

- Static hosting only (GitHub Pages). No server.
- All state in browser localStorage.
- PWA: offline-capable, installable, mobile-first.
- No build step. Alpine.js via CDN. No npm.
- Deck definitions in `games/dungeonquest.json` (one JSON per game type).
- New games = drop in new JSON file. App loads by game selection.
- JSON is read-only config. localStorage holds runtime state (draw order, discards).
- Multiple decks per game JSON (DungeonQuest ships several distinct decks).
- Per-game theme in `themes/<game-id>.css` (CSS vars + Google Font @import). No game colors in `style.css`.
- `backImage` paths relative to app root; must be included in sw.js ASSETS for offline.
- Card draw animation is CSS-only; duration controlled by `--draw-duration` CSS var — no JS timers.

## §I — Interfaces

| id | surface | notes |
|----|---------|-------|
| I.browser | Browser localStorage | persist runtime deck state (draw order, discards, inventory) |
| I.gamejson | `games/<name>.json` | deck defs: `backImage` per deck; cards with `name`, `count`, optional `type`/`description`/`image` |
| I.pwa | Web App Manifest + Service Worker | installable, offline |
| I.ghpages | GitHub Pages | static deploy, root or /docs |
| I.ui | Touch-friendly UI | draw on tap, reset controls |
| I.theme | `themes/<game-id>.css` | CSS custom property overrides + Google Font @import, one file per game |

## §V — Invariants

| id | invariant |
|----|-----------|
| V1 | remaining + discard count == initial card count at all times |
| V2 | draw from empty deck shows empty state, no error thrown |
| V3 | state persists across browser refresh via localStorage |
| V4 | full reset restores ALL decks to configured initial shuffled state |
| V5 | shuffle uses Fisher-Yates — uniform distribution |
| V6 | service worker caches all app assets + game JSONs for offline use |
| V7 | theme injected = `themes/<config.id>.css` — loaded dynamically after game JSON, no game-specific values in style.css |
| V8 | all color/font tokens are CSS custom properties; style.css defines fallback defaults only |
| V9 | game theme CSS derived from official game visual design (cover + interior pages of source material) |
| V10 | theme CSS `<link id="game-theme">` present in HTML `<head>` before any JS executes — no FOUC on initial load |
| V11 | per deck: `draw.length + discard.length + inventory_cards_from_deck.length === initial_total` — supersedes V1 |
| V12 | `keep(deckId)` moves last discard entry → global inventory `{card, deckId}`; `use(idx)` moves inventory[idx] → source deck discard |
| V13 | all card fields (`type`, `description`, `image`) and deck `backImage` optional — absent = no UI element rendered, no error |
| V14 | card flip animation duration set by CSS var `--draw-duration` (default `1s`); no JS timers control animation length |
| V15 | inventory items display same card detail fields (type, description, image) as drawn-card area — same `cardConfig()` lookup |
| V16 | `.current-card-area` has `min-height` large enough to hold full card detail (name + type badge + description) without layout shift on draw |
| V17 | desktop layout (≥800px): 3 fixed columns — `decks-panel` (left, ~260px), `active-card-panel` (center, flex-grow), `inventory-panel` (right, ~260px); no wrapping |
| V18 | active card is global (one per app); tracks `{card, deckId}` of last drawn across all decks; cleared on full reset; source deck name shown as badge above card |
| V19 | deck list rows: optional `backImage` thumbnail (24×36px) left of deck name; count badges; Draw btn; per-deck Reshuffle btn (disabled when discard=0); no per-deck card detail area |
| V20 | mobile layout (<800px): 3-tab view switcher (Decks \| Card \| Inventory); one panel visible at time; default tab = Decks |
| V21 | "Reshuffle All Discards" btn at bottom of decks panel; reshuffles all decks with discards |
| V22 | active card panel action btns: "Keep in Inventory" (→ keep()), "Discard" (clears active card display only), "Draw Another" (draw() from same deckId) |
| V23 | active-card-wrap uses `justify-content: center` + fixed gap — content vertically centered in panel, not pinned top/bottom; no `margin-top: auto` on actions |

## §T — Tasks

| id | status | task | cites |
|----|--------|------|-------|
| T1 | x | project scaffold: index.html, app.js, style.css, manifest.json, sw.js, games/ dir | I.ghpages |
| T2 | x | dungeonquest.json: define all DungeonQuest decks with card names + counts | I.gamejson |
| T3 | x | game loader: fetch games/<name>.json on app start, populate Alpine store | I.gamejson,I.browser |
| T4 | x | deck engine: Fisher-Yates shuffle, draw, discard tracking in Alpine store | V1,V2,V5 |
| T5 | x | deck play UI: deck cards remaining, draw button, discard count, drawn card display | V2,I.ui |
| T6 | x | localStorage persistence: save/restore runtime state on every change | I.browser,V3 |
| T7 | x | reset controls: reset single deck (reshuffle discards), full game reset (all decks fresh) | V4 |
| T8 | x | PWA: manifest.json, service worker cache all assets + game JSONs, icons | I.pwa,V6 |
| T9 | x | GitHub Actions deploy workflow: push to gh-pages on main merge | I.ghpages |
| T10 | x | theme loader: inject `<link id="game-theme">` pointing to `themes/<id>.css` after game JSON loads; add to sw.js cache | V7,I.theme |
| T11 | x | refactor style.css to CSS vars only (fallback defaults); create themes/dungeonquest.css — Cinzel+Crimson Text fonts, blood-red/parchment/dark-stone palette | V7,V8,I.theme |
| T12 | x | update themes/dungeonquest.css to match DQ Revised Edition PDF — parchment interior + dark cover header; create docs/styleguide/dungeonquest.md | V7,V8,V9,I.theme |
| T13 | x | extend JSON schema: add `backImage` per deck, add `type`/`description` to all cards in dungeonquest.json | V13,I.gamejson |
| T14 | x | deck back-image UI: render stacked card-back using `deck.backImage` in deck-card header area | V13,I.ui |
| T15 | x | card detail display: show `type`, `description`, `image` for last-drawn card when fields present in config | V13,I.ui |
| T16 | x | inventory engine: global `inventory` array in store; `keep(deckId)` last-discard→inventory; `use(idx)` inventory→source-deck-discard; full reset clears inventory; localStorage extended | V11,V12,I.browser |
| T17 | x | inventory UI: "Keep" btn on drawn card; inventory panel listing held cards with "Use" btn each; per-card deckId label | V12,I.ui |
| T18 | x | card draw animation: CSS flip keyframes on `.deck-card`; `--draw-duration: 1s` in style.css; JS adds trigger class on draw, removes after transition ends | V14,I.ui |
| T19 | x | inventory item card detail: show type badge, description, image per inventory item using `cardConfig(item.deckId, item.card)` | V13,V15,I.ui |
| T20 | x | fix drawn-card layout shift: set `min-height` on `.current-card-area` to hold full detail without reflow | V16,I.ui |
| T21 | x | layout refactor: 3-column CSS grid desktop (decks-panel \| active-card-panel \| inventory-panel); 3-tab mobile switcher | V17,V20,I.ui |
| T22 | x | refactor deck list to compact rows: name + count badges + draw btn per row; remove per-deck card detail / keep / reshuffle-deck btns from rows; add "Reshuffle All Discards" at panel bottom | V19,V21,I.ui |
| T23 | x | global active-card: add `activeCard:{card,deckId}\|null` to Alpine store; `draw()` sets it; full reset clears it; active-card-panel renders it with source deck badge | V18,I.browser |
| T24 | x | active-card-panel actions: "Keep in Inventory" → `keep()` then clear active; "Discard" → clear active only; "Draw Another" → `draw(activeCard.deckId)` | V22,I.ui |
| T25 | x | mobile tab switcher: `activeTab` in Alpine store (decks\|card\|inventory); tab bar at bottom; highlight active; switch on tap | V20,I.ui |
| T26 | . | deck row icon: render `backImage` as 24×36px thumbnail left of deck name (V13 optional — absent = no element) | V13,V19,I.ui |
| T27 | . | per-deck reshuffle btn in deck row: small secondary btn disabled when discard=0; calls `resetDeck(deck.id)` | V19,I.ui |
| T28 | . | active card panel centering: `justify-content: center` + uniform gap on `.active-card-wrap`; remove `margin-top: auto` from actions | V23,I.ui |

## §B — Bug log

| id | date | cause | fix |
|----|------|-------|-----|
| B1 | 2026-05-04 | theme CSS injected after async JSON fetch — style.css dark fallbacks paint first (FOUC) | pre-link theme in HTML head; applyTheme skips re-inject if href unchanged (V10) |
