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

## §I — Interfaces

| id | surface | notes |
|----|---------|-------|
| I.browser | Browser localStorage | persist runtime deck state (draw order, discards) |
| I.gamejson | `games/<name>.json` | deck definitions, card names + counts, read-only |
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

## §B — Bug log

| id | date | cause | fix |
|----|------|-------|-----|
| B1 | 2026-05-04 | theme CSS injected after async JSON fetch — style.css dark fallbacks paint first (FOUC) | pre-link theme in HTML head; applyTheme skips re-inject if href unchanged (V10) |
