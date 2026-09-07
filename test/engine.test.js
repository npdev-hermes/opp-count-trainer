import test from 'node:test';
import assert from 'node:assert/strict';
import { cardValue, oppDelta, createShoe, BlackjackEngine, normalizedTC, total } from '../src/engine.js';

let rigId = 0;
const card = rank => ({ rank, suit: '♠', id: `rig-${rank}-${rigId++}` });
function rig(engine, ranks) {
  // Pad the unseen tail to exercise the rig without triggering safety shuffle.
  engine.shoe = [...Array(60).fill('T').map(card), ...ranks.map(card).reverse()];
  engine.cutCard = 0;
  engine.discard = []; engine.roundCards = [];
}

test('OPP values count only 2-6, and final hand is low cards minus one', () => {
  assert.equal(cardValue('2'), 1); assert.equal(cardValue('6'), 1);
  assert.equal(cardValue('A'), 0); assert.equal(cardValue('T'), 0);
  assert.equal(oppDelta(['2','K','6','A']), 1);
  assert.equal(oppDelta(['2','5','K']), 1);
  assert.equal(oppDelta(['A','K','Q']), -1);
});

test('shoe size, configured cut threshold, and new shoe state are exact', () => {
  assert.equal(createShoe(2, () => 0.5).length, 104);
  const engine = new BlackjackEngine({ decks: 6, rng: () => 0.5, cutCard: 52 });
  assert.equal(engine.shoe.length, 312); assert.equal(engine.cutCard, 52);
  assert.equal(engine.runningCount, 6); assert.equal(engine.shoeNumber, 1);
  engine.newShoe();
  assert.equal(engine.shoeNumber, 2); assert.equal(engine.runningCount, 6);
  assert.equal(engine.phase, 'ready'); assert.deepEqual(engine.hands, []);
});

test('round-robin deal leaves hole card uncounted and RC unchanged until round end', () => {
  const e = new BlackjackEngine({ decks: 2, rng: () => 0.5 });
  rig(e, ['9','5','6','T','7','5','6','9']);
  e.startRound();
  assert.deepEqual(e.player.cards.map(c => c.rank), ['9','7']);
  assert.deepEqual(e.opponents.map(h => h.cards.map(c => c.rank)), [['5','5'], ['6','6']]);
  assert.deepEqual(e.dealer.cards.map(c => c.rank), ['T','9']);
  assert.equal(e.runningCount, 6); assert.equal(e.visibleCountedCards.length, 7);
  assert.equal(e.dealer.cards[1].hidden, true);
  e.stand();
  assert.equal(e.phase, 'round-complete');
  assert.equal(e.runningCount, 6);
});

test('US peek ends on dealer natural and natural-vs-natural is a push', () => {
  const e = new BlackjackEngine({ decks: 1 });
  rig(e, ['A','5','6','A','K','5','6','T']);
  assert.equal(e.startRound(25), true);
  assert.equal(e.phase, 'round-complete');
  assert.equal(e.player.outcome, 'push');
  assert.equal(e.dealer.outcome, 'dealer-blackjack');
  assert.equal(e.bankroll, 1000); // no action was permitted and no wager was lost
  assert.equal(e.results.length, 4);
});

test('player natural pays 3:2, while a split 21 is not blackjack', () => {
  const natural = new BlackjackEngine({ decks: 1 });
  rig(natural, ['A','5','6','9','K','5','6','7','2']);
  natural.startRound(20); natural.stand();
  assert.equal(natural.player.outcome, 'blackjack');
  assert.equal(natural.netProfit, 30); assert.equal(natural.bankroll, 1030);

  const split = new BlackjackEngine({ decks: 1 });
  rig(split, ['8','5','6','9','8','5','6','7','5','5','2']);
  split.startRound(10);
  assert.equal(split.canSplit(), true); assert.equal(split.split(), true);
  split.stand(); split.stand();
  assert.equal(split.hands.length, 2);
  assert.ok(split.hands.every(h => h.outcome !== 'blackjack'));
});

test('double and split require bankroll, DAS is allowed, max four and aces get one card', () => {
  const e = new BlackjackEngine({ decks: 1, initialBankroll: 35 });
  rig(e, ['8','5','6','9','8','5','6','7','2','3','4','5']);
  e.startRound(10);
  assert.equal(e.canSplit(), true); e.split();
  assert.equal(e.hands.length, 2); assert.equal(e.canDouble(), true);
  e.double(); e.stand();
  assert.equal(e.phase, 'round-complete');

  const aces = new BlackjackEngine({ decks: 1 });
  rig(aces, ['A','5','6','9','A','5','6','7','K','Q','2']);
  aces.startRound(); assert.equal(aces.split(), true);
  assert.equal(aces.hands.length, 2);
  assert.ok(aces.hands.every(h => h.cards.length === 2 && h.stood));
  assert.equal(aces.canSplit(), false);
});

test('normalized TC uses (RC - 6) and exact decks remaining', () => {
  assert.equal(normalizedTC(10, 2), 2); assert.equal(normalizedTC(9, 0), null);
  assert.equal(total([{ rank: 'A' }, { rank: '9' }, { rank: '5' }]), 15);
});

test('cut is checked only between rounds and card accounting reconciles across random shoes', () => {
  const e = new BlackjackEngine({ decks: 2, rng: Math.random });
  let completed = 0;
  for (let i = 0; i < 80; i++) {
    if (!e.startRound(1)) break;
    if (e.phase === 'playing') e.stand();
    assert.equal(e.phase, 'round-complete');
    assert.equal(e.shoe.length + e.discard.length, e.totalCards);
    assert.equal(e.cardsDealt, e.discard.length);
    completed++;
  }
  assert.ok(completed > 10);
  assert.equal(e.shoe.length + e.discard.length, e.totalCards);
});
