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
| I.browser | Browser localStorage | persist runtime deck state (draw order, discards, per-player inventories, playerCount) |
| I.gamejson | `games/<name>.json` | deck defs: `backImage` per deck, optional `image` (deck face art, null = fallback to `backImage`); cards with `name`, `count`, optional `type`/`description`/`image`/`triggers`; optional root-level `info` + `combat` objs |
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
| V17 | desktop layout (≥800px): 3-column CSS grid — equal thirds `1fr 1fr 1fr` (decks-panel left, active-card-panel center, inventory-panel right); no wrapping; panels overflow-y scroll independently — supersedes prior `minmax(420px,2fr) minmax(280px,1fr) minmax(260px,1fr)` sizing |
| V18 | active card is global (one per app); tracks `{card, deckId}` of last drawn across all decks; cleared on full reset; source deck name shown as badge above card |
| V19 | deck panel entries = visual card block: `backImage` stack left, deck name, optional deck `description`, remaining+discard count badges, per-deck reshuffle ↺ btn (compact); clicking entire block = `draw(deckId)` + `setTab('card')`; active deck (matches `activeCard.deckId`) gets accent border. Decks rendered into `.decks-list` per V53 |
| V20 | mobile layout (<800px): 3-tab view switcher (Decks \| Card \| Inventory); one panel visible at time; default tab = Decks |
| V21 | "Reshuffle All Discards" btn at bottom of decks panel; reshuffles all decks with discards |
| V22 | active card panel action btns: "Keep in Inventory" (→ keep()), "Discard" (clears active card display only), "Draw Another" (draw() from same deckId) |
| V23 | active-card-wrap uses `justify-content: center` + fixed gap — content vertically centered in panel, not pinned top/bottom; no `margin-top: auto` on actions |
| V24 | deck JSON may have optional `description` string at deck level; absent = no description rendered (same rule as V13 for card fields) |
| V25 | active card panel renders card as game-card frame: image (if present) else blank art area, card name, type badge, description, "FROM: [deckName]" label below frame; KEEP / DISCARD / DRAW ANOTHER buttons styled with emoji/icon prefix |
| V26 | inventory panel items = mini card thumbnail layout: small image or type-badge-colored placeholder, card name, brief description clipped to 1 line; "View Full Inventory" link at panel bottom |
| V27 | header shows instruction text "Tap a deck to draw a card" centered on desktop (≥800px); hidden on mobile |
| V28 | mobile tab label for card tab = "Active" (not "Card") |
| V29 | buttons inside flex-row containers (`.header-inner`) must override `.btn { width: 100% }` with `width: auto; flex-shrink: 0` — `.btn` full-width default is for column layouts only |
| V30 | activeCard cleared on reshuffleAll(); cleared on resetDeck(deckId) when activeCard?.deckId === deckId — supersedes "cleared on full reset" scope of V18 |
| V31 | `info` field in game JSON is optional at root level; absent = no `?` btn rendered, panel never shown |
| V32 | `?` btn in header right triggers info panel; dismisses via X btn, click/tap outside panel, or ESC key |
| V33 | desktop (≥800px): panel slides in from right as fixed overlay (translateX 100%→0); mobile (<800px): sheet slides up from bottom (translateY 100%→0) |
| V34 | info panel styled with active theme CSS vars (`--color-surface`, `--color-border`, `--font-heading`, `--font-body`); no hardcoded colors |
| V35 | `info` JSON shape: `{ "title": string, "subtitle"?: string, "sections": [{ "heading": string, "items": [{ "icon"?: string, "text": string }] }] }` |
| V36 | `infoOpen: boolean` in Alpine store; false on init; toggled by openInfo()/closeInfo(); does not affect deck/card/inventory state |
| V37 | mobile info-panel CSS must set `max-width: 100%` (or `none`) to override desktop `max-width: 95vw`; panel must be exactly viewport-width with no left gap |
| V38 | inventory has no max-size cap; `keep()` never rejects; guide text must not reference any item limit |
| V39 | game JSON may have optional root-level `combat` obj: `{ victory_image?, death_image? }`; absent fields = styled text fallback screens, no error |
| V40 | card `triggers` array optional (extends V13); each trigger: `{ type, ...params }`; unrecognised type = no-op |
| V41 | combat trigger shape: `{ type:"combat", health: int, attribute_type: string, escape_penalty: string }` |
| V42 | `draw()`: after setting activeCard, checks drawn card's `triggers`; first trigger with `type:"combat"` → sets `combatState`; activeCard still set (card remains drawn) |
| V43 | `combatState`: `null \| { card, deckId, health, maxHealth, attribute_type, escape_penalty, status }` where status ∈ `active\|victory\|fled\|died`; persisted to localStorage |
| V44 | combat overlay renders when `combatState !== null`; shows: monster name, health pips (current/max), attribute check label; round buttons: -2 / -1 / Flee / Player Died (no 0 button) |
| V45 | health pips: filled circles = remaining health, empty circles = lost health; updates immediately on damage |
| V46 | end-state rules: health ≤ 0 → status=`victory`; Flee → status=`fled`, show `escape_penalty` text; Player Died → status=`died`; each shows image (if `config.combat.*_image` present) or styled text fallback; dismiss btn clears `combatState` |
| V47 | active combat screen must NOT display monster health pips or numeric health count — health tracked in `combatState` internally only, never visible to player |
| V48 | active combat screen shows card image when `cardConfig(deckId, card).image` present; absent = show deck `backImage` as art placeholder (same opacity/style as card-frame-art-placeholder per V25) |
| V49 | active combat screen shows static combat round instructions: (1) Roll 2d6 (2) result ≤ attribute → monster −1 wound (3) result > attribute → you −1 wound (4) doubles → 2 wounds instead; text is dim/secondary, always visible during active combat |
| V50 | deck `image` field optional (null = absent); render fallback uses `deck.image ?? deck.backImage` — extends V13 fallback rule to deck level |
| V51 | combat trigger schema: `escape_wounds: int` required, `escape_penalty: string` optional override; UI renders override if present else `"Suffer N wounds."` derived from int — supersedes V41 |
| V52 | card `name` unique within a deck — `cardConfig()` lookup is name-keyed; CSV-derived duplicates disambiguated via name suffix (e.g. `"Gold Coins (200g)"`) |
| V53 | desktop `.decks-list` is CSS grid `repeat(auto-fill, minmax(280px, 1fr))` with `gap: 8px` — auto wraps to multi-column whenever decks panel is wide enough; mobile (<800px) stays single-column flex (one tile per row, full-width) — supersedes prior 190px minmax |
| V54 | `.card-frame` max-width capped (340px); card frame stays centered within `.active-card-panel`, never overflows horizontally; `.active-card-actions` max-width capped to 380px — supersedes prior 220/280 caps |
| V55 | sw.js install must NOT use `cache.addAll` (rejects whole precache on first failure); loop ASSETS with per-asset `cache.put(req, await fetch(req))` wrapped in try/catch — partial cache > no cache; supersedes V6 install semantics |
| V56 | precache ASSETS list contains only same-origin paths; remote/CDN URLs (e.g. cdn.jsdelivr.net) excluded — runtime cache-first branch in fetch handler caches them on first successful online fetch |
| V57 | fetch handler navigation branch: `e.request.mode === 'navigate'` falls back to `caches.match('./index.html')` on network failure (not exact-URL match); guarantees app shell loads offline regardless of URL shape/query/path |
| V58 | `navigator.serviceWorker.register()` chain has explicit `.catch` handler logging to console — silent registration failure forbidden |
| V59 | `playerCount` ∈ [1,4] when set; `players.length === playerCount`; player IDs stable 1..playerCount; player names default `"Player 1".."Player 4"`; reshuffle does not touch players |
| V60 | per deck: `draw.length + discard.length + sum(player.inventory where item.deckId === deckId).length === initial_total` — supersedes V11 |
| V61 | `keep(deckId, playerId)` moves last `deck.discard` entry → `players[playerId-1].inventory` as `{card, deckId}`; `use(playerId, idx)` moves `players[playerId-1].inventory[idx]` → source deck `discard` — supersedes V12 |
| V62 | `moveDiscardToPlayer(deckId, discardIdx, playerId)` removes `deck.discard[discardIdx]` and pushes `{card, deckId}` to `players[playerId-1].inventory`; remainder of discard preserves chronological order |
| V63 | active-card panel KEEP control renders one button per active player (label `KEEP → P{n}`) — count == `playerCount`; no global single KEEP btn; no picker modal — supersedes the "Keep in Inventory" portion of V22/V25 |
| V64 | player-count selector overlay shows when `playerCount` is null/unset; modal blocks all other interaction; choices 1/2/3/4 write to store + persist; cannot be dismissed without choosing |
| V65 | mid-game player-count change: increasing keeps existing player inventories intact; decreasing requires confirmation when removed players hold non-empty inventories — removed-player items merged into player 1; trigger via Menu/Quick-Help settings entry |
| V66 | deck tile shows neither `description` text nor truncated subtitle — only numeric index badge, backImage stack, deck name, count badges, reshuffle btn — supersedes content portion of V19 |
| V67 | deck tile numeric index badge = 1-based position in `config.decks[]` array (display order); rendered top-left of tile |
| V68 | right-rail panel (desktop ≥800px) is three stacked sub-panels: `Inventory (Players)` summary (rows of `name`, item-count, chevron → fullscreen player view), `Discard History` (intro text + btn → fullscreen discard view), `Quick Help` (intro text + btn → existing Adventurer's Guide info panel) |
| V69 | mobile tab labels: `Decks \| Active Card \| Menu`; `Menu` tab renders the same three sub-panels listed in V68 — supersedes V20 label list and V28 |
| V70 | fullscreen Player Inventory view: player name header, list of held cards with `Use` btn each (returns card to source deck discard per V61), close btn; opens via summary-row chevron or row tap; closes via close btn / backdrop / ESC |
| V71 | fullscreen Discard History view: per-deck sections (only decks with non-empty discard rendered), cards listed in chronological discard order (oldest first), each row shows card name + source-deck badge + per-player `→ P{n}` btns calling `moveDiscardToPlayer` per V62; close via btn / backdrop / ESC |
| V72 | active-card panel button row: with `playerCount === 4`, 4 KEEP btns + DISCARD + DRAW ANOTHER fit inside `minmax(280px, 1fr)` center column at viewport 1024px without horizontal scroll; KEEP btns may compress to icon+number when needed |
| V73 | combat remains global (single `combatState`); damage/flee/died btns unchanged; combat does not interact with `players[]` |
| V74 | localStorage migration: on `restore()`, if persisted state has top-level `inventory` array but no `players`, set `playerCount = 1`, `players = [{id:1, name:"Player 1", inventory: <legacy>}]`, drop `inventory`; one-shot, persists in new shape |
| V75 | full reset (Reset All btn) clears `playerCount` to null and `players[]` to `[]` in addition to V4 deck-reset behaviour; immediately re-triggers V64 selector overlay before any deck/card state is consumed — supersedes part of V4 |
| V76 | active-card panel renders no KEEP btns until `playerCount` is set; if user lands on active-card view with `playerCount === null` (impossible after V64/V75 but defensive), buttons row shows DISCARD + DRAW ANOTHER only |
| V77 | UI base scale +50% over prior baseline: `html { font-size: 24px }` (was 16px); `--gap: 24px` (was 16px). All `rem`-based sizing inherits scale; no per-element font overrides beyond `style.css` defaults |
| V78 | desktop `.deck-stack` `78×114px` (was `52×76px`, +50%); inner `.deck-stack-layer` `66×102px` (was `44×68px`); mobile mini-stack `60×90px` (was `40×60px`); rotation/offset transforms scale proportionally so card stack reads as deck-art primary at tile width 280px |
| V79 | distance-readable text targets at `font-size: 24px` root: panel headings ≥ `1.05rem` (was 0.75rem); deck names ≥ `1.05rem` (was 0.9rem); card-frame name ≥ `1.25rem`; card-frame description ≥ `1rem`; count badges ≥ `0.95rem`. Letter-spacing on uppercase headings reduced 0.12em → 0.08em to compensate |
| V80 | V72 KEEP-btn fit re-verified at new scale: 4 KEEP btns + DISCARD + DRAW ANOTHER must fit center column (`1fr` of viewport ≥1024px ≈ 341px) without horizontal scroll; icon+number compaction kicks in earlier — supersedes verification clause of V72 |

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
| T26 | x | deck row icon: render `backImage` as 24×36px thumbnail left of deck name (V13 optional — absent = no element) | V13,V19,I.ui |
| T27 | x | per-deck reshuffle btn in deck row: small secondary btn disabled when discard=0; calls `resetDeck(deck.id)` | V19,I.ui |
| T28 | x | active card panel centering: `justify-content: center` + uniform gap on `.active-card-wrap`; remove `margin-top: auto` from actions | V23,I.ui |
| T29 | x | add optional `description` field to deck schema; populate in dungeonquest.json for all 4 decks | V24,I.gamejson |
| T30 | x | gamify deck panel: replace compact rows with visual card blocks (large backImage stack, name, description, count badges, click-to-draw, active-deck accent border, compact ↺ btn) | V19,V24,I.ui |
| T31 | x | gamify active card: game-card frame display (image or placeholder, name, type, description, FROM label); styled KEEP/DISCARD/DRAW ANOTHER buttons | V25,I.ui |
| T32 | x | gamify inventory: mini card thumbnail rows (type-colored placeholder, name, 1-line description); "View Full Inventory" btn | V26,I.ui |
| T33 | x | header instruction text centered desktop-only; relabel mobile card tab "Active" | V27,V28,I.ui |
| T34 | x | fix header layout: `.header-inner .btn` → `width: auto; flex-shrink: 0`; `header h1` → `white-space: nowrap`; instruction text fills flex center | V27,V29,I.ui |
| T35 | x | fix reshuffleAll() + resetDeck() to null activeCard per V30 | V18,V30 |
| T36 | x | extend game JSON: add optional root-level `info` obj; populate dungeonquest.json Adventurer's Guide (How to Use + Expected Use from the Box sections) | V31,V35,I.gamejson |
| T37 | x | Alpine store: add `infoOpen: false`, `openInfo()`, `closeInfo()`; `?` btn in header renders only when `config.info` present | V31,V32,V36 |
| T38 | x | info panel HTML: fixed overlay, parchment-styled, title (Cinzel), optional subtitle, section headings + item list with optional icon; X close btn top-right; click-outside + ESC dismiss | V32,V34,V35,I.ui |
| T39 | x | desktop CSS: `.info-panel` fixed right drawer (width ~380px, full height); transform translateX(100%)→(0) on open; transition 0.3s ease; semi-transparent backdrop overlay | V33,V34,I.ui |
| T40 | x | mobile CSS (<800px): `.info-panel` fixed bottom sheet (height ~70vh, full width); transform translateY(100%)→(0) on open; border-radius top corners; same transition | V33,V34,I.ui |
| T41 | x | fix mobile info-panel: add `max-width: 100%` to mobile media query override — removes left gap caused by inherited desktop `max-width: 95vw` | V37,I.ui |
| T42 | x | remove "eight cards max" from dungeonquest.json guide text; update to describe unlimited inventory; remove any other hardcoded limit references | V38,I.gamejson |
| T43 | x | extend game JSON: add optional root-level `combat` obj; add optional `triggers` array to card schema; add Monster Deck to dungeonquest.json with placeholder monsters | V39,V40,V41,I.gamejson |
| T44 | x | Alpine store: add `combatState: null`; add `dealDamage(n)`, `fleeCombat()`, `playerDied()`, `dismissCombat()`; modify `draw()` to detect combat trigger and set combatState; extend `persist()`/`restore()` to include combatState; `buildDecks()` clears combatState | V42,V43,I.browser |
| T45 | x | combat overlay HTML: fixed full-screen overlay, parchment-styled; monster name (Cinzel), health pips row, attribute check label, -2/-1/Flee/Player Died btns; end-state screen with image or fallback text, dismiss btn | V44,V45,V46,I.ui |
| T46 | x | combat CSS: z-index above info panel (60+); health pip row; parchment card styling; end-state screen with image or styled text fallback; btn variants for damage/-1/-2, Flee (secondary), Player Died (danger) | V44,V45,V46,I.ui |
| T47 | x | remove health pips row from active combat HTML; remove `.combat-health-row`/`.combat-pips`/`.combat-pip`/`.combat-health-count` CSS | V47,I.ui |
| T48 | x | add card image (or deck backImage placeholder) to active combat HTML using `cardConfig()`; styled same as card-frame-art-placeholder | V48,I.ui |
| T49 | x | add combat round instructions block to active combat HTML: 4-item list (Roll 2d6 / ≤ attr → monster wound / > attr → you wound / doubles → 2 wounds); dim secondary style | V49,I.ui |
| T50 | x | replace `games/dungeonquest.json` decks with 11 CSV-derived decks (dungeon/door/search/crypt/corpse/catacomb/monster/trap/treasure/dragon/rune); drop fortune/chamber/city; add `image:null` per deck; disambiguate dup card names | V50,V51,V52,I.gamejson |
| T51 | x | generate 11 deck back-image SVGs in `images/cards/` matching existing style (120×180, dark fill, themed stroke); add to sw.js ASSETS for offline cache | V6,V13,I.pwa |
| T52 | x | engine: combat trigger reads `escape_wounds` int; `combatState.escape_penalty` derived as `trigger.escape_penalty ?? "Suffer N wounds."` in `app.js` `draw()` | V51,I.browser |
| T53 | x | amend `style.css` `.app-layout` desktop grid: `grid-template-columns: minmax(420px, 2fr) minmax(280px, 1fr) minmax(260px, 1fr)` | V17,I.ui |
| T54 | x | refactor `.decks-list` desktop CSS to `display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px;`; mobile (<800px) keeps flex column; shrink `.deck-stack` to ~40×60px so tile reads cleanly at 190px width | V53,V19,I.ui |
| T55 | x | verify `.card-frame` + `.active-card-actions` fit inside narrower center column (≥280px); confirm card image, name, description, FROM label, KEEP/DISCARD/DRAW ANOTHER all visible without horizontal scroll at viewport 1024px and 1440px | V54,I.ui |
| T56 | x | rewrite sw.js install: loop ASSETS with per-asset `cache.put` in try/catch; bump CACHE name (`dq-v4` → `dq-v5`) to evict poisoned partial caches | V55,I.pwa |
| T57 | x | drop `https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js` from sw.js ASSETS — runtime cache-first handler already covers it | V56,I.pwa |
| T58 | x | sw.js fetch handler: add `e.request.mode === 'navigate'` branch; on network fail fall back to `caches.match('./index.html')` | V57,I.pwa |
| T59 | x | index.html SW register: chain `.catch(err => console.error('SW registration failed', err))` | V58,I.pwa |
| T60 | x | extend Alpine store: add `players[]`, `playerCount: null`, `activeView: null`, `selectedPlayerId: null`; remove flat `inventory`; update `persist()`/`restore()` shape; implement V74 migration | V59,V74,I.browser |
| T61 | x | refactor store actions: `keep(deckId, playerId)`, `use(playerId, idx)`, add `moveDiscardToPlayer(deckId, discardIdx, playerId)`, `setPlayerCount(n)`, `openPlayerInventory(playerId)`, `openDiscardHistory()`, `closeActiveView()`; update `keepActive(playerId)` to delegate | V61,V62,V65,I.browser |
| T62 | x | player-count selector overlay: blocking modal when `playerCount === null`; 1/2/3/4 buttons; on click writes store + persists + closes; theme-styled; ESC does NOT dismiss | V64,I.ui |
| T63 | x | reset flow: `resetAll()` sets `playerCount=null`, `players=[]`, then V4 deck-reset; selector overlay re-appears next tick; "Reset All" btn confirm prompt unchanged | V75,I.ui |
| T64 | x | refactor deck tile in `index.html`: remove `.deck-entry-desc` element; add `.deck-entry-index` numeric badge (1-based) top-left; CSS in `style.css`; mobile + desktop both show index | V66,V67,I.ui |
| T65 | x | refactor active-card panel buttons: replace single KEEP btn with N buttons (one per `players[]`) labelled `KEEP → P{n}`; each calls `keep(activeCard.deckId, n)` then clears active card; verify fit at viewport 1024px with playerCount=4 (compress to icon+number if overflow) | V63,V72,I.ui |
| T66 | x | right-rail layout: split `.inventory-panel` HTML into 3 sub-panels — `Inventory (Players)` summary rows, `Discard History` intro + CTA btn, `Quick Help` intro + Adventurer's Guide btn (existing `openInfo`); CSS for sub-panel headers + row chevron | V68,I.ui |
| T67 | x | fullscreen Player Inventory overlay: HTML + CSS; renders when `activeView === 'player-inventory'`; reads `selectedPlayerId`; lists `players[selectedPlayerId-1].inventory` with `Use` btns; close via btn / backdrop / ESC | V70,I.ui |
| T68 | x | fullscreen Discard History overlay: HTML + CSS; renders when `activeView === 'discard-history'`; iterates `config.decks` filtering non-empty `deck.discard`; per-card rows with N `→ P{n}` btns calling `moveDiscardToPlayer`; close via btn / backdrop / ESC | V71,V62,I.ui |
| T69 | x | mobile tab switcher: rename labels `Active`→`Active Card`, `Inventory`→`Menu`; `Menu` tab content renders the three V68 sub-panels; remove standalone inventory tab content | V69,I.ui |
| T70 | x | settings entry to change player count mid-game: btn in Quick Help sub-panel; opens count selector with V65 confirmation flow when reducing count drops items | V65,I.ui |
| T71 | x | sw.js: bump CACHE name (`dq-v5` → `dq-v6`) so legacy clients refresh app shell after migration ships | V55,I.pwa |
| T72 | x | bump `style.css` root: `html { font-size: 24px }`; `--gap: 24px`; verify no fixed-px overrides break layout | V77,I.ui |
| T73 | x | rewrite `.app-layout` desktop grid → `grid-template-columns: 1fr 1fr 1fr`; remove `minmax(...)` constraints | V17,I.ui |
| T74 | x | bump `.decks-list` desktop grid → `repeat(auto-fill, minmax(280px, 1fr))`; verify wrap at 1024 / 1440 / 1920 | V53,I.ui |
| T75 | x | bump `.deck-stack` 52→78, `.deck-stack-layer` 44→66 desktop; mobile mini-stack 40→60; scale offset transforms; verify no clipping inside tile padding | V78,I.ui |
| T76 | x | bump `.card-frame max-width: 340px`; `.active-card-actions max-width: 380px`; verify center panel content fits at 1fr/1024 viewport | V54,I.ui |
| T77 | x | audit + bump small-text `rem` values per V79 (panel-heading, deck-entry-name, card-frame-name/description, deck-count-* badges); reduce uppercase letter-spacing 0.12em → 0.08em | V79,I.ui |
| T78 | x | re-verify T65 / V72 KEEP-btn row at new scale with `playerCount=4`; tighten icon+number compaction threshold | V80,I.ui |

## §B — Bug log

| id | date | cause | fix |
|----|------|-------|-----|
| B1 | 2026-05-04 | theme CSS injected after async JSON fetch — style.css dark fallbacks paint first (FOUC) | pre-link theme in HTML head; applyTheme skips re-inject if href unchanged (V10) |
| B2 | 2026-05-06 | `.btn { width: 100% }` in flex-row header squashes `.header-instruction` — Reset All btn expands, no room for centered text | T34, V29 |
| B3 | 2026-05-06 | reshuffleAll()/resetDeck() don't clear activeCard — drawn card returns to draw pile while still shown active | V30 |
| B4 | 2026-05-06 | mobile `.info-panel` inherits desktop `max-width: 95vw`; mobile query sets `width: 100%` but not `max-width` → panel is 95vw wide with `right:0`, 5vw gap left | V37 |
| B5 | 2026-05-06 | guide text "eight cards max" is inaccurate — no cap enforced in `keep()`; inventory should be unlimited per game design | V38 |
| B6 | 2026-05-06 | V44/V45 specified health pips visible on combat screen — design intent wrong; health must be hidden from player (tracked internally only) | V47 |
| B7 | 2026-05-06 | active combat screen has no card image — player can't visualise monster; card image or deck backImage placeholder must show | V48 |
| B8 | 2026-05-09 | desktop layout `280px 1fr 260px` + single-column `.decks-list` wastes horizontal space when game ships many decks (DungeonQuest = 11) — left panel scrolls while center column oversized | V17 amended, V53 added |
| B9 | 2026-05-10 | sw.js install uses `cache.addAll` with remote CDN URL in ASSETS — any CDN hiccup rejects entire precache → SW never activates → offline reload shows browser native "no internet" page. Fetch handler also lacks navigation fallback (exact-URL match only) and register() call has no .catch (silent fail). | V55,V56,V57,V58 |
| B10 | 2026-05-10 | global flat `inventory` cannot represent multi-player play; deck description in tile wastes vertical space at 11 decks; no UI to recover from accidental discards; "Reset All" did not reset player setup state | V59-V76, T60-T71: per-player `players[]` reshape + 1-4 selector at first run + on Reset All (V75); compact tiles (V66/V67); discard-history fullscreen with move-to-inventory (V62/V71) |
| B11 | 2026-05-10 | layout + type sized for desk use; unreadable across a board-game table; deck panel hogs 60%+ of width while card frame capped at 220px | V77-V80, T72-T78: equal-thirds grid + 24px root + larger deck-stack + larger card-frame |
