document.addEventListener('alpine:init', () => {
  Alpine.store('game', {
    loaded: false,
    error: null,
    config: null,
    decks: [],
    players: [],           // V59: [{id, name, inventory[{card,deckId}]}]
    playerCount: null,     // V59: null until V64 selector; V64 overlay blocks until set
    activeView: null,      // 'player-inventory'|'discard-history'|'player-count-change'|null
    selectedPlayerId: null,
    activeCard: null,      // V18: {card, deckId} | null
    activeTab: 'decks',    // V20: 'decks'|'card'|'menu'
    drawAnimating: false,  // V14
    infoOpen: false,       // V36
    combatState: null,     // V43

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
          // V74: migrate legacy flat inventory to per-player shape
          if (saved.inventory && !saved.players) {
            saved.players = [{ id: 1, name: 'Player 1', inventory: saved.inventory }];
            saved.playerCount = 1;
          }
          this.players = saved.players ?? [];
          this.playerCount = saved.playerCount ?? null;
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

    // V75: full reset clears playerCount→null (triggers V64 overlay) + players + decks
    buildDecks() {
      this.players = [];
      this.playerCount = null;
      this.activeCard = null;
      this.combatState = null;
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

    // V2, V18, V42: draw, set activeCard, check combat trigger
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
          escape_penalty: combatTrigger.escape_penalty ?? `Suffer ${combatTrigger.escape_wounds} wound${combatTrigger.escape_wounds === 1 ? '' : 's'}.`,
          status: 'active'
        };
      }
      this.persist();
    },

    drawAnother() {
      if (!this.activeCard) return;
      this.draw(this.activeCard.deckId);
    },

    clearActive() {
      this.activeCard = null;
      this.persist();
    },

    // V61, V63: move active card → player inventory, clear activeCard
    keepActive(playerId) {
      if (!this.activeCard) return;
      const deck = this.decks.find(d => d.id === this.activeCard.deckId);
      if (!deck || deck.discard.length === 0) return;
      const player = this.players.find(p => p.id === playerId);
      if (!player) return;
      const card = deck.discard.pop();
      player.inventory.push({ card, deckId: deck.id });
      this.activeCard = null;
      this.persist();
    },

    // V61: move last discard → player inventory (standalone, no activeCard clear)
    keep(deckId, playerId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || deck.discard.length === 0) return;
      const player = this.players.find(p => p.id === playerId);
      if (!player) return;
      const card = deck.discard.pop();
      player.inventory.push({ card, deckId });
      this.persist();
    },

    // V61: player inventory item → source deck discard
    use(playerId, idx) {
      const player = this.players.find(p => p.id === playerId);
      if (!player || idx < 0 || idx >= player.inventory.length) return;
      const [item] = player.inventory.splice(idx, 1);
      const deck = this.decks.find(d => d.id === item.deckId);
      if (deck) deck.discard.push(item.card);
      this.persist();
    },

    // V62: remove deck.discard[discardIdx] → player inventory; preserves discard order
    moveDiscardToPlayer(deckId, discardIdx, playerId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck || discardIdx < 0 || discardIdx >= deck.discard.length) return;
      const player = this.players.find(p => p.id === playerId);
      if (!player) return;
      const [card] = deck.discard.splice(discardIdx, 1);
      player.inventory.push({ card, deckId });
      this.persist();
    },

    // V21, V30
    reshuffleAll() {
      this.decks.forEach(d => {
        if (d.discard.length === 0) return;
        d.draw = this.shuffle([...d.draw, ...d.discard]);
        d.discard = [];
      });
      this.activeCard = null;
      this.persist();
    },

    // V30
    resetDeck(deckId) {
      const deck = this.decks.find(d => d.id === deckId);
      if (!deck) return;
      deck.draw = this.shuffle([...deck.draw, ...deck.discard]);
      deck.discard = [];
      if (this.activeCard?.deckId === deckId) this.activeCard = null;
      this.persist();
    },

    // V4, V75: full reset — buildDecks nulls playerCount → V64 overlay re-triggers
    resetAll() {
      this.buildDecks();
      this.persist();
    },

    // V59, V64, V65: set player count — initial setup and mid-game change
    setPlayerCount(n) {
      if (n < 1 || n > 4) return;
      if (this.playerCount === null) {
        // Initial setup (V64)
        this.players = Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          name: `Player ${i + 1}`,
          inventory: []
        }));
        this.playerCount = n;
        this.activeView = null;
        this.persist();
        return;
      }
      // Mid-game change (V65)
      if (n === this.playerCount) { this.closeActiveView(); return; }
      if (n > this.playerCount) {
        for (let i = this.playerCount; i < n; i++) {
          this.players.push({ id: i + 1, name: `Player ${i + 1}`, inventory: [] });
        }
        this.playerCount = n;
        this.closeActiveView();
        this.persist();
        return;
      }
      // Decreasing — check removed players for items
      const removedPlayers = this.players.filter(p => p.id > n);
      const removedItems = removedPlayers.flatMap(p => p.inventory);
      if (removedItems.length > 0) {
        const names = removedPlayers.map(p => p.name).join(', ');
        if (!window.confirm(`${names} hold ${removedItems.length} item(s). Merge into Player 1 and continue?`)) return;
        this.players[0].inventory.push(...removedItems);
      }
      this.players = this.players.filter(p => p.id <= n);
      this.playerCount = n;
      this.closeActiveView();
      this.persist();
    },

    setTab(tab) {
      this.activeTab = tab;
    },

    openInfo() { this.infoOpen = true; },
    closeInfo() { this.infoOpen = false; },

    openPlayerInventory(playerId) {
      this.selectedPlayerId = playerId;
      this.activeView = 'player-inventory';
    },

    openDiscardHistory() {
      this.activeView = 'discard-history';
    },

    closeActiveView() {
      this.activeView = null;
      this.selectedPlayerId = null;
    },

    // V42-V46
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

    cardConfig(deckId, cardName) {
      return this.deckConfig(deckId)?.cards.find(c => c.name === cardName) ?? null;
    },

    deckName(deckId) {
      return this.deckConfig(deckId)?.name ?? deckId;
    },

    // V3, V59: persist players/playerCount instead of flat inventory
    persist() {
      if (!this.config) return;
      localStorage.setItem('dq-state', JSON.stringify({
        gameId: this.config.id,
        players: this.players,
        playerCount: this.playerCount,
        activeCard: this.activeCard,
        combatState: this.combatState,
        decks: this.decks.map(d => ({ id: d.id, draw: d.draw, discard: d.discard }))
      }));
    },

    // V7, V10
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
