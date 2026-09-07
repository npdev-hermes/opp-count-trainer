import { BlackjackEngine } from './engine.js';

export const BANKROLL_KEY = 'opp-trainer-money-v2';
export const SNAPSHOT_KEY = 'opp-trainer-active-v2';
const finite = value => Number.isFinite(value) ? value : 0;

export function loadBankroll(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(BANKROLL_KEY));
    if (!value || !Number.isFinite(value.bankroll) || !Number.isFinite(value.netProfit)) return null;
    const result = {
      bankroll: value.bankroll,
      netProfit: value.netProfit,
      lastRoundNet: finite(value.lastRoundNet),
      ledger: Array.isArray(value.ledger) ? value.ledger.slice(0, 20) : []
    };
    if (value.sessionId) result.sessionId = value.sessionId;
    if (Number.isInteger(value.roundSerial)) result.roundSerial = value.roundSerial;
    return result;
  } catch { return null; }
}

export function saveBankroll(storage = globalThis.localStorage, money) {
  try { storage.setItem(BANKROLL_KEY, JSON.stringify(money)); } catch { /* storage is optional */ }
}

export function engineSnapshot(engine) {
  return {
    decks: engine.decks,
    initialBankroll: engine.initialBankroll,
    state: JSON.parse(JSON.stringify(engine))
  };
}

export function restoreEngine(snapshot) {
  if (!snapshot?.state || !Number.isInteger(snapshot.decks)) return null;
  const engine = new BlackjackEngine({ decks: snapshot.decks, initialBankroll: snapshot.initialBankroll ?? 1000 });
  Object.assign(engine, snapshot.state);
  return engine;
}

export function saveSnapshot(storage = globalThis.localStorage, { engine, graded, quizTarget, stats }) {
  try { storage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 2, engine: engineSnapshot(engine), graded: !!graded, quizTarget, stats })); } catch { /* storage is optional */ }
}

export function loadSnapshot(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    const engine = restoreEngine(value?.engine);
    return engine ? { engine, graded: !!value.graded, quizTarget: value.quizTarget ?? null, stats: value.stats } : null;
  } catch { return null; }
}

export function clearSnapshot(storage = globalThis.localStorage) {
  try { storage.removeItem(SNAPSHOT_KEY); } catch { /* storage is optional */ }
}
