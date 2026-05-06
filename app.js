document.addEventListener('alpine:init', () => {
  Alpine.store('game', {
    loaded: false,
    error: null,
    config: null,
    decks: [],
    inventory: [],
    activeCard: null,     // V18: {card, deckId} | null — global last-drawn card
    activeTab: 'decks',   // V20: 'decks'|'card'|'inventory' — mobile tab state
    drawAnimating: false, // V14: CSS flip animation trigger
    infoOpen: false,      // V36: info panel state
    combatState: null,    // V43: null | { card, deckId, health, maxHealth, attribute_type, escape_penalty, status }

    init() {
      this.load('games/dungeonquest.json');
    },

    async load(url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
        this.config = await res.json();
        this.applyTheme(this.config.id);
        const saved = this.restore();
        if (saved && saved.gameId === this.config.id) {
          this.inventory = saved.inventory ?? [];
          this.activeCard = saved.activeCard ?? null;
          this.combatState = saved.combatState ?? null;
          this.decks = this.config.decks.map(d => {
            const s = saved.decks.find(sd => sd.id === d.id);
            return s
              ? { id: d.id, name: d.name, draw: s.draw, discard: s.discard }
              : { id: d.id, name: d.name, draw: this.shuffle(this.expand(d.cards)), discard: [] };
          });
        } else {
          this.buildDecks();
        }
        this.loaded = true;
        this.persist();
      } catch (e) {
        this.error = e.message;
      }
    },

    buildDecks() {
      this.inventory = [];
      this.activeCard = null;
      this.combatState = null; // V43
      this.decks = this.config.decks.map(d => ({
        id: d.id,
        name: d.name,
        draw: this.shuffle(this.expand(d.cards)),
        discard: []
      }));
    },

    expand(cards) {
      return cards.flatMap(c => Array(c.count).fill(c.name));
    },

    // Fisher-Yates shuffle (V5)
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    // Draw top card — no-op on empty deck (V2). Sets global activeCard (V18) + animation flag (V14).
    // Checks triggers: combat trigger sets combatState (V42).
    draw(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.draw.length === 0) return;
      const card = deck.draw.pop();
      deck.discard.push(card);
      this.activeCard = { card, deckId };
      this.drawAnimating = true;
      const cfg = this.cardConfig(deckId, card);
      const combatTrigger = cfg?.triggers?.find(t => t.type === 'combat');
      if (combatTrigger) {
        this.combatState = {
          card,
          deckId,
          health: combatTrigger.health,
          maxHealth: combatTrigger.health,
          attribute_type: combatTrigger.attribute_type,
          escape_penalty: combatTrigger.escape_penalty,
          status: 'active'
        };
      }
      this.persist();
    },

    // Draw another card from same deck as active card (V22)
    drawAnother() {
      if (!this.activeCard) return;
      this.draw(this.activeCard.deckId);
    },

    // Clear active card display — card stays in deck.discard (V22)
    clearActive() {
      this.activeCard = null;
      this.persist();
    },

    // Move active card from deck discard → inventory, then clear active (V12, V22)
    keepActive() {
      if (!this.activeCard) return;
      const deckId = this.activeCard.deckId;
      this.activeCard = null; // clear first so persist() saves null
      this.keep(deckId);      // keep() calls persist()
    },

    // Move last-drawn card from deck discard → global inventory (V12)
    keep(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.discard.length === 0) return;
      const card = deck.discard.pop();
      this.inventory.push({ card, deckId });
      this.persist();
    },

    // Consume inventory item → source deck discard (V12)
    use(idx) {
      if (idx < 0 || idx >= this.inventory.length) return;
      const [item] = this.inventory.splice(idx, 1);
      const deck = this.decks.find(d => d.id === item.deckId);
      if (deck) deck.discard.push(item.card);
      this.persist();
    },

    // Reshuffle all decks with discards — inventory items unaffected (V21)
    reshuffleAll() {
      this.decks.forEach(d => {
        if (d.discard.length === 0) return;
        d.draw = this.shuffle([...d.draw, ...d.discard]);
        d.discard = [];
      });
      this.activeCard = null; // V30
      this.persist();
    },

    // Reshuffle single deck discards back into draw pile
    resetDeck(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) return;
      deck.draw = this.shuffle([...deck.draw, ...deck.discard]);
      deck.discard = [];
      if (this.activeCard?.deckId === deckId) this.activeCard = null; // V30
      this.persist();
    },

    // Full reset: rebuild all decks + clear inventory + clear active card (V4, V18)
    resetAll() {
      this.buildDecks();
      this.persist();
    },

    // Mobile tab switcher (V20)
    setTab(tab) {
      this.activeTab = tab;
    },

    // Info panel (V32, V36)
    openInfo() { this.infoOpen = true; },
    closeInfo() { this.infoOpen = false; },

    // Combat (V42-V46)
    dealDamage(n) {
      if (!this.combatState || this.combatState.status !== 'active') return;
      this.combatState.health = Math.max(0, this.combatState.health - n);
      if (this.combatState.health <= 0) this.combatState.status = 'victory';
      this.persist();
    },

    fleeCombat() {
      if (!this.combatState) return;
      this.combatState.status = 'fled';
      this.persist();
    },

    playerDied() {
      if (!this.combatState) return;
      this.combatState.status = 'died';
      this.persist();
    },

    dismissCombat() {
      this.combatState = null;
      this.persist();
    },

    deckConfig(deckId) {
      return this.config?.decks.find(d => d.id === deckId) ?? null;
    },

    // Look up card config by deck + name (V13 — returns null when absent, no error)
    cardConfig(deckId, cardName) {
      return this.deckConfig(deckId)?.cards.find(c => c.name === cardName) ?? null;
    },

    deckName(deckId) {
      return this.deckConfig(deckId)?.name ?? deckId;
    },

    // Save runtime state to localStorage (V3) — includes activeCard (V18)
    persist() {
      if (!this.config) return;
      localStorage.setItem('dq-state', JSON.stringify({
        gameId: this.config.id,
        inventory: this.inventory,
        activeCard: this.activeCard,
        combatState: this.combatState,
        decks: this.decks.map(d => ({ id: d.id, draw: d.draw, discard: d.discard }))
      }));
    },

    // Inject per-game theme CSS (V7). Skip if already loaded (V10 — avoids FOUC on init).
    applyTheme(gameId) {
      const href = `themes/${gameId}.css`;
      const existing = document.getElementById('game-theme');
      if (existing) {
        if (existing.getAttribute('href') === href) return;
        existing.remove();
      }
      const link = document.createElement('link');
      link.id = 'game-theme';
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    },

    restore() {
      try {
        return JSON.parse(localStorage.getItem('dq-state'));
      } catch {
        return null;
      }
    }
  });
});
