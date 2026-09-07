import test from 'node:test';
import assert from 'node:assert/strict';
import { BlackjackEngine } from '../src/engine.js';
import { loadBankroll, saveBankroll, saveSnapshot, loadSnapshot, clearSnapshot, SNAPSHOT_KEY } from '../src/persistence.js';

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

test('untagged active snapshots migrate legacy +6 RC without changing money or hand', () => {
  const engine = new BlackjackEngine({ decks: 2, initialBankroll: 777 });
  rigNonNatural(engine); engine.startRound(25);
  engine.runningCount = 8;
  engine.history = [{ round: 1, rc: 11, results: [] }];
  const storage = memoryStorage();
  const legacyState = JSON.parse(JSON.stringify(engine)); delete legacyState.countConvention;
  storage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 2, engine: { decks: 2, initialBankroll: 777, state: legacyState }, graded: false, quizTarget: { rc: 8, tc: 4 }, stats: { asked: 2, correct: 2, history: [] } }));
  const restored = loadSnapshot(storage);
  assert.equal(restored.engine.runningCount, 2);
  assert.equal(restored.engine.history[0].rc, 5);
  assert.equal(restored.engine.bankroll, 777);
  assert.equal(restored.engine.committed, 25);
  assert.equal(restored.quizTarget, null);
  assert.equal(restored.graded, false);
  assert.equal(restored.engine.countConvention, 'zero-v1');
});

test('migrating an already graded completed round does not re-grade its stats', () => {
  const engine = new BlackjackEngine({ decks: 1 });
  engine.phase = 'round-complete'; engine.runningCount = 7; engine.history = [{ round: 1, rc: 7, results: [] }];
  const state = JSON.parse(JSON.stringify(engine)); delete state.countConvention;
  const storage = memoryStorage();
  storage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 2, engine: { decks: 1, state }, graded: true, quizTarget: { rc: 7, tc: 2 }, stats: { asked: 2, correct: 1, history: [{ round: 1 }] } }));
  const restored = loadSnapshot(storage);
  assert.equal(restored.graded, true);
  assert.equal(restored.quizTarget, null);
  assert.deepEqual(restored.stats, { asked: 2, correct: 1, history: [{ round: 1 }] });
});
