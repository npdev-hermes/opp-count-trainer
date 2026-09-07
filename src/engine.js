const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const LOW = new Set(['2','3','4','5','6']);

export function cardValue(rank) { return LOW.has(rank) ? 1 : 0; }
export function oppDelta(ranks) { return ranks.reduce((sum, rank) => sum + cardValue(rank), 0) - 1; }
export function normalizedTC(runningCount, decksRemaining) {
  return decksRemaining > 0 ? Number(((runningCount - 6) / decksRemaining).toFixed(1)) : null;
}
export function createShoe(decks = 6, rng = Math.random) {
  const cards = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS)
    cards.push({ rank, suit, id: `${d}-${suit}-${rank}` });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function total(hand) {
  const cards = Array.isArray(hand) ? hand : hand?.cards || [];
  let value = 0, aces = 0;
  for (const card of cards) {
    value += ['T','J','Q','K'].includes(card.rank) ? 10 : card.rank === 'A' ? 11 : Number(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (value > 21 && aces--) value -= 10;
  return value;
}
function blackjack(hand) { return hand.cards.length === 2 && total(hand) === 21 && !hand.fromSplit; }

export class BlackjackEngine {
  constructor({ decks = 6, rng = Math.random, cutCard, opponentCount = 2, initialBankroll = 1000 } = {}) {
    this.opponentCount = opponentCount === 0 ? 0 : 2; this.decks = decks; this.rng = rng; this.totalCards = decks * 52;
    this.cutCard = cutCard ?? Math.floor(this.totalCards * 0.25);
    this.initialBankroll = initialBankroll; this.bankroll = initialBankroll; this.netProfit = 0;
    this.round = 0; this.shoeNumber = 0; this.history = [];
    this.newShoe();
  }
  newShoe() {
    this.shoe = createShoe(this.decks, this.rng); this.discard = [];
    this.runningCount = 6; this.cutReached = false; this.phase = 'ready';
    this.hands = []; this.opponents = []; this.dealer = null; this.results = [];
    this.visibleCountedCards = []; this.roundCards = []; this.roundBet = 0; this.committed = 0;
    this.shoeNumber++;
  }
  get cardsDealt() { return this.totalCards - this.shoe.length; }
  get totalCardsDealt() { return this.cardsDealt; }
  get balance() { return this.bankroll; }
  get profit() { return this.netProfit; }
  get decksRemaining() { return this.shoe.length / 52; }
  draw(hidden = false) {
    if (!this.shoe.length) throw new Error('shoe reserve exhausted during round');
    const card = { ...this.shoe.pop(), hidden };
    this.roundCards.push(card);
    return card;
  }
  startRound(bet = 10) {
    if (this.phase === 'playing') return false;
    if (!Number.isFinite(bet) || bet <= 0 || bet > this.bankroll) return false;
    if (this.shoe.length <= this.cutCard) this.newShoe();
    // Eight cards are needed before any optional player action.
    // Seven final hands can consume at most 7 × 30 hard-value points.
    // Keep more than that in reserve, ensuring no mid-round reshuffle.
    if (this.shoe.reduce((s,c)=>s+(c.rank==='A'?1:['T','J','Q','K'].includes(c.rank)?10:Number(c.rank)),0) <= 210) this.newShoe();
    this.round++; this.phase = 'playing'; this.results = []; this.hands = [];
    this.visibleCountedCards = []; this.roundCards = []; this.roundBet = bet; this.committed = bet;
    const player = { id: 'player-0', cards: [], bet, stood: false, doubled: false, splitAces: false, outcome: null };
    const opponents = Array.from({length:this.opponentCount}, (_,i)=>i).map(i => ({ id: `seat-${i}`, cards: [], bet, stood: false, outcome: null }));
    const dealer = { id: 'dealer', cards: [], outcome: null };
    // Deal one card to every seat, then repeat. Dealer's second card is hidden.
    const seats = [player, ...opponents, dealer];
    for (let pass = 0; pass < 2; pass++) for (const hand of seats) {
      const card = this.draw(hand.id === 'dealer' && pass === 1);
      hand.cards.push(card);
      if (!(hand.id === 'dealer' && pass === 1)) this.visibleCountedCards.push(card);
    }
    this.hands = [player]; this.opponents = opponents; this.dealer = dealer;
    // US peek: a dealer natural ends the round before a player action.
    if (blackjack(dealer) || blackjack(player)) { this.hands.forEach(h => h.stood = true); this.resolveRound(); }
    return true;
  }
  get player() { return this.hands[0]; }
  get activeIndex() { return this.hands.findIndex(h => !h.stood); }
  get activeHand() { return this.hands[this.activeIndex] || this.hands[0]; }
  value(hand = this.activeHand) { return total(hand); }
  total(hand = this.activeHand) { return total(hand); }
  normalizedTC() { return normalizedTC(this.runningCount, this.decksRemaining); }
  canHit(hand = this.activeHand) { return this.phase === 'playing' && !!hand && !hand.stood && total(hand) < 21; }
  canDouble(hand = this.activeHand) { return this.canHit(hand) && hand.cards.length === 2 && this.bankroll - this.committed >= hand.bet; }
  hit() {
    const hand = this.activeHand; if (!this.canHit(hand)) return false;
    hand.cards.push(this.draw());
    if (total(hand) >= 21) { hand.stood = true; if (total(hand) > 21) hand.outcome = 'bust'; this.nextOrResolve(); }
    return true;
  }
  stand() {
    const hand = this.activeHand; if (this.phase !== 'playing' || !hand || hand.stood) return false;
    hand.stood = true; this.nextOrResolve(); return true;
  }
  double() {
    const hand = this.activeHand; if (!this.canDouble(hand)) return false;
    hand.bet *= 2; hand.doubled = true; this.committed += hand.bet / 2;
    hand.cards.push(this.draw()); hand.stood = true;
    if (total(hand) > 21) hand.outcome = 'bust'; this.nextOrResolve(); return true;
  }
  canSplit(hand = this.activeHand) {
    return this.phase === 'playing' && !!hand && !hand.stood && !hand.splitAces && hand.cards.length === 2 &&
      hand.cards[0].rank === hand.cards[1].rank && this.hands.length < 4 && this.bankroll - this.committed >= hand.bet;
  }
  split() {
    const old = this.activeHand; if (!this.canSplit(old)) return false;
    const [a, b] = old.cards, aces = a.rank === 'A';
    this.committed += old.bet;
    const first = { ...old, id: `player-${this.hands.length}`, cards: [a, this.draw()], splitAces: aces, fromSplit: true, stood: aces, outcome: null };
    const second = { ...old, id: `player-${this.hands.length + 1}`, cards: [b, this.draw()], splitAces: aces, fromSplit: true, stood: aces, outcome: null };
    this.hands.splice(this.activeIndex, 1, first, second);
    if (aces) this.nextOrResolve();
    return true;
  }
  nextOrResolve() { if (!this.hands.some(hand => !hand.stood)) this.resolveRound(); }
  revealDealer() {
    if (!this.dealer.cards[1].hidden) return;
    this.dealer.cards[1].hidden = false; this.visibleCountedCards.push(this.dealer.cards[1]);
    while (total(this.dealer) < 17) { const card = this.draw(); this.dealer.cards.push(card); this.visibleCountedCards.push(card); }
  }
  resolveRound() {
    if (this.phase !== 'playing') return;
    if (!blackjack(this.dealer)) {
      for (const hand of this.opponents) while (total(hand)<17) hand.cards.push(this.draw());
    }
    this.revealDealer(); const dealerValue = total(this.dealer), dealerNatural = blackjack(this.dealer);
    const outcomeFor = hand => {
      const value = total(hand);
      if (dealerNatural) return blackjack(hand) ? 'push' : 'loss';
      if (value > 21) return 'bust';
      if (blackjack(hand)) return 'blackjack';
      if (dealerValue > 21 || value > dealerValue) return 'win';
      if (value === dealerValue) return 'push';
      return 'loss';
    };
    let playerProfit = 0;
    for (const hand of [...this.hands, ...this.opponents]) {
      hand.outcome = outcomeFor(hand);
      const delta = oppDelta(hand.cards.map(c => c.rank));
      this.runningCount += delta;
      this.results.push({ handId: hand.id, ranks: hand.cards.map(c => c.rank), delta, outcome: hand.outcome });
      if (hand.id.startsWith('player-')) playerProfit += hand.outcome === 'blackjack' ? hand.bet * 1.5 : hand.outcome === 'win' ? hand.bet : hand.outcome === 'push' ? 0 : -hand.bet;
    }
    this.dealer.outcome = dealerValue > 21 ? 'dealer-bust' : dealerNatural ? 'dealer-blackjack' : `dealer-${dealerValue}`;
    const dealerDelta = oppDelta(this.dealer.cards.map(c => c.rank)); this.runningCount += dealerDelta;
    this.results.push({ handId: 'dealer', ranks: this.dealer.cards.map(c => c.rank), delta: dealerDelta, outcome: this.dealer.outcome });
    this.discard.push(...this.roundCards); this.netProfit += playerProfit; this.bankroll += playerProfit;
    this.phase = 'round-complete'; this.history.push({ round: this.round, rc: this.runningCount, results: this.results.map(result => ({ ...result })) });
  }
}
export { RANKS, SUITS };
