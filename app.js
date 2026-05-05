document.addEventListener('alpine:init', () => {
  Alpine.store('game', {
    loaded: false,
    error: null,
    config: null,
    decks: [],
    inventory: [],  // [{card: string, deckId: string}] — global held items (V12)

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
          this.decks = this.config.decks.map(d => {
            const s = saved.decks.find(sd => sd.id === d.id);
            return s
              ? { id: d.id, name: d.name, draw: s.draw, discard: s.discard, animating: false }
              : { id: d.id, name: d.name, draw: this.shuffle(this.expand(d.cards)), discard: [], animating: false };
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
      this.decks = this.config.decks.map(d => ({
        id: d.id,
        name: d.name,
        draw: this.shuffle(this.expand(d.cards)),
        discard: [],
        animating: false
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

    // Draw top card — no-op on empty deck (V2). Sets animating flag for CSS flip (V14).
    draw(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.draw.length === 0) return;
      deck.discard.push(deck.draw.pop());
      deck.animating = true;
      this.persist();
    },

    // Move last-drawn card from deck discard → global inventory (V12)
    keep(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.discard.length === 0) return;
      const card = deck.discard.pop();
      this.inventory.push({ card, deckId });
      this.persist();
    },

    // Consume inventory item → source deck discard (V12, V13)
    use(idx) {
      if (idx < 0 || idx >= this.inventory.length) return;
      const [item] = this.inventory.splice(idx, 1);
      const deck = this.decks.find(d => d.id === item.deckId);
      if (deck) deck.discard.push(item.card);
      this.persist();
    },

    // Reshuffle discards back into draw pile (inventory items from this deck remain held)
    resetDeck(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) return;
      deck.draw = this.shuffle([...deck.draw, ...deck.discard]);
      deck.discard = [];
      this.persist();
    },

    // Full reset: rebuild all decks + clear inventory (V4)
    resetAll() {
      this.buildDecks();
      this.persist();
    },

    // Look up deck config definition
    deckConfig(deckId) {
      return this.config?.decks.find(d => d.id === deckId) ?? null;
    },

    // Look up card config by deck + name (V13 — returns null when absent, no error)
    cardConfig(deckId, cardName) {
      return this.deckConfig(deckId)?.cards.find(c => c.name === cardName) ?? null;
    },

    // Look up display name for a deck
    deckName(deckId) {
      return this.deckConfig(deckId)?.name ?? deckId;
    },

    // Save runtime state to localStorage (V3) — excludes animating flag
    persist() {
      if (!this.config) return;
      localStorage.setItem('dq-state', JSON.stringify({
        gameId: this.config.id,
        inventory: this.inventory,
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
