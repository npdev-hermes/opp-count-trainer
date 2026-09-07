import test from 'node:test';
import assert from 'node:assert/strict';
import { BlackjackEngine } from '../src/engine.js';
import { loadBankroll, saveBankroll, saveSnapshot, loadSnapshot, clearSnapshot } from '../src/persistence.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('bankroll ledger survives reload without changing the settled balance', () => {
  const storage = memoryStorage();
  saveBankroll(storage, { bankroll: 1015, netProfit: 15, lastRoundNet: 15, ledger: [{ round: 1, net: 15, balance: 1015 }] });
  assert.deepEqual(loadBankroll(storage), { bankroll: 1015, netProfit: 15, lastRoundNet: 15, ledger: [{ round: 1, net: 15, balance: 1015 }] });
});

function rigNonNatural(engine) {
  engine.shoe = [...Array(60).fill('T').map((_, i) => ({ rank: 'T', suit: '♠', id: `tail-${i}` })), ...['9','5','6','T','7','5','6','9'].map((rank, i) => ({ rank, suit: '♠', id: `rig-${i}` })).reverse()];
  engine.cutCard = 0;
}

test('active engine snapshot restores committed wager and hidden hole card', () => {
  const engine = new BlackjackEngine({ decks: 2 });
  rigNonNatural(engine);
  assert.equal(engine.startRound(25), true);
  const storage = memoryStorage();
  saveSnapshot(storage, { engine, graded: false, quizTarget: null });
  const snapshot = loadSnapshot(storage);
  assert.equal(snapshot.engine.round, engine.round);
  assert.equal(snapshot.engine.committed, 25);
  assert.equal(snapshot.engine.dealer.cards[1].hidden, true);
  clearSnapshot(storage);
  assert.equal(loadSnapshot(storage), null);
});

test('settlement remains one-time after a round is saved and loaded', () => {
  const engine = new BlackjackEngine({ decks: 1 });
  engine.startRound(10);
  engine.stand();
  const settled = engine.bankroll;
  const storage = memoryStorage();
  saveSnapshot(storage, { engine, graded: false, quizTarget: null });
  const restored = loadSnapshot(storage).engine;
  assert.equal(restored.phase, 'round-complete');
  restored.resolveRound();
  assert.equal(restored.bankroll, settled);
  assert.equal(restored.netProfit, engine.netProfit);
});
