import { BlackjackEngine } from './engine.js?v=9';

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
  const legacyConvention = snapshot.state.countConvention !== 'zero-v1';
  const engine = new BlackjackEngine({ decks: snapshot.decks, initialBankroll: snapshot.initialBankroll ?? 1000 });
  Object.assign(engine, snapshot.state);
  if (legacyConvention) {
    engine.runningCount -= 6;
    if (Array.isArray(engine.history)) for (const item of engine.history) if (Number.isFinite(item.rc)) item.rc -= 6;
    engine.countConvention = 'zero-v1';
  }
  return engine;
}

export function saveSnapshot(storage = globalThis.localStorage, { engine, graded, quizTarget, stats }) {
  try { storage.setItem(SNAPSHOT_KEY, JSON.stringify({ version: 9, engine: engineSnapshot(engine), graded: !!graded, quizTarget, stats })); } catch { /* storage is optional */ }
}

export function loadSnapshot(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(SNAPSHOT_KEY));
    const engine = restoreEngine(value?.engine);
    const migrated = !value?.engine?.state?.countConvention || value.engine.state.countConvention !== 'zero-v1';
    return engine ? { engine, graded: migrated ? (!!value.graded && engine.phase === 'round-complete') : !!value.graded, quizTarget: migrated ? null : value.quizTarget ?? null, stats: value.stats } : null;
  } catch { return null; }
}

export function clearSnapshot(storage = globalThis.localStorage) {
  try { storage.removeItem(SNAPSHOT_KEY); } catch { /* storage is optional */ }
}
