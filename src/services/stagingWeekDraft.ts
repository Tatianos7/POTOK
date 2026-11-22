import {decodeStagingRealWeek, type StagingRealWeekView} from './stagingRealWeek';
import {decodeStagingSideDishes, type StagingSideDishEdit} from './stagingWeekSideDishes';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const contract = 'potok-browser-reference-week-draft-v1';
const maxBytes = 2_000_000;
export type StagingWeekDraft = {view: StagingRealWeekView; savedAt: string; timeZone: string; weekStart: string; target: number; sideDishes: StagingSideDishEdit[]};
function key(accountId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) throw Error('INVALID_DRAFT_ACCOUNT');
  return 'potok:staging-reference-week-draft:v1:' + accountId;
}
function decode(raw: string, accountId: string): StagingWeekDraft {
  if (new Blob([raw]).size > maxBytes) throw Error('DRAFT_TOO_LARGE');
  const r = JSON.parse(raw);
  if (!r || r.contract !== contract || r.accountId !== accountId || r.scope !== 'BROWSER_TEST_DRAFT_ONLY'
    || typeof r.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(r.savedAt) || !Number.isFinite(Date.parse(r.savedAt))
    || typeof r.timeZone !== 'string' || r.timeZone.length > 100 || typeof r.payload !== 'string'
    || !Number.isInteger(r.target) || r.target <= 50 || r.target > 10000) throw Error('INVALID_DRAFT');
  new Intl.DateTimeFormat('ru-RU', {timeZone: r.timeZone});
  const view = decodeStagingRealWeek(JSON.parse(r.payload));
  if (view.savedGoal && view.savedGoal.accountId !== accountId) throw Error('INVALID_DRAFT_ACCOUNT');
  if (!view.savedGoal && !view.testScenario && ![1400,1600,1800,2000].includes(r.target)) throw Error('INVALID_DRAFT');
  if (view.report.days.length !== 7 || view.report.target !== r.target || view.report.days[0].date !== r.weekStart) throw Error('INVALID_DRAFT');
  return {view, savedAt: r.savedAt, timeZone: r.timeZone, weekStart: r.weekStart, target: r.target,
    sideDishes: decodeStagingSideDishes(view, r.sideDishes)};
}
/** One latest reference draft per account/browser, never a Plan/FACT writer.
 * Caller must verify current Auth before accessing this local convenience copy.
 * Validation is structural; browser storage is not server authority or encrypted. */
export function loadStagingWeekDraft(store: Store, accountId: string): StagingWeekDraft | null {
  const raw = store.getItem(key(accountId));
  return raw === null ? null : decode(raw, accountId);
}
export function saveStagingWeekDraft(store: Store, accountId: string, payload: string, timeZone: string, now = new Date()): StagingWeekDraft {
  if (new Blob([payload]).size > maxBytes) throw Error('DRAFT_TOO_LARGE');
  const view = decodeStagingRealWeek(JSON.parse(payload));
  const slot = key(accountId);
  let sideDishes: StagingSideDishEdit[] | undefined;
  // Same snapshot replay is a no-op. A single atomic replacement retains at most
  // one draft; quota failures cannot partially overwrite an older saved week.
  const existing = store.getItem(slot);
  if (existing !== null) {
    try {
      const prior = decode(existing, accountId), envelope = JSON.parse(existing);
      if (envelope.payload === payload) {
        if (prior.timeZone === timeZone) return prior;
        sideDishes = prior.sideDishes;
      }
    } catch { /* Explicit Save can replace a corrupt local draft. Reads never do. */ }
  }
  const raw = JSON.stringify({contract, scope:'BROWSER_TEST_DRAFT_ONLY', accountId, payload, sideDishes,
    target:view.report.target, weekStart:view.report.days[0]?.date, timeZone, savedAt:now.toISOString()});
  const result = decode(raw, accountId);
  store.setItem(slot, raw);
  return result;
}
export function removeStagingWeekDraft(store: Store, accountId: string) {store.removeItem(key(accountId));}

/** Update the already saved draft in one write. Scope this edit to the snapshot and
 * saved revision the user saw when confirming, including edits from other tabs. */
export function saveStagingWeekSideDishes(store: Store, accountId: string, expected: StagingWeekDraft,
  sideDishes: readonly StagingSideDishEdit[], now = new Date()): StagingWeekDraft {
  const slot = key(accountId), raw = store.getItem(slot);
  if (raw === null) throw Error('STAGING_DRAFT_CHANGED');
  const current = decode(raw, accountId);
  if (current.view.snapshot !== expected.view.snapshot || current.savedAt !== expected.savedAt
    || current.timeZone !== expected.timeZone || JSON.stringify(current.sideDishes) !== JSON.stringify(expected.sideDishes)) {
    throw Error('STAGING_DRAFT_CHANGED');
  }
  const next = JSON.stringify({...JSON.parse(raw), sideDishes, savedAt: now.toISOString()});
  const validated = decode(next, accountId);
  if (JSON.stringify(validated.sideDishes) === JSON.stringify(current.sideDishes)) return current;
  store.setItem(slot, next);
  return validated;
}
