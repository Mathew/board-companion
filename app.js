document.addEventListener('alpine:init', () => {
  Alpine.store('game', {
    loaded: false,
    error: null,
    config: null,
    decks: [],

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

    // Draw top card — no-op on empty deck (V2). Maintains draw+discard==total (V1).
    draw(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.draw.length === 0) return;
      deck.discard.push(deck.draw.pop());
      this.persist();
    },

    // Reshuffle discards back into draw pile
    resetDeck(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) return;
      deck.draw = this.shuffle([...deck.draw, ...deck.discard]);
      deck.discard = [];
      this.persist();
    },

    // Full reset: rebuild all decks from config (V4)
    resetAll() {
      this.buildDecks();
      this.persist();
    },

    // Save runtime state to localStorage (V3)
    persist() {
      if (!this.config) return;
      localStorage.setItem('dq-state', JSON.stringify({
        gameId: this.config.id,
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
