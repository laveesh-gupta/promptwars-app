import { analyze } from './analyze';
import { array, record, string, validateNarrative, validateSnapshot } from './validation';
import type { Narrative, Snapshot } from './types';
export const HISTORY_KEY = 'vayumanak.history.v1';
export function readHistory(input: string): Snapshot[] {
  if (new TextEncoder().encode(input).length > 3000000)
    throw new Error('History exceeds 3 MB.');
  return array(JSON.parse(input), 8).map((raw) => {
    const snapshot = validateSnapshot(raw);
    const baseline = snapshot.baseline
      ? {
          ...snapshot.baseline,
          metrics: analyze(snapshot.baseline.dataset, snapshot.baseline.context),
        }
      : undefined;
    snapshot.metrics = analyze(snapshot.dataset, snapshot.context, baseline);
    const v = record(raw);
    // Sample prose is trusted only for built-in samples; imported prose gets the same checks as live output.
    snapshot.narrative = snapshot.legacyLanguage
      ? validateLegacy(v.narrative)
      : validateNarrative(v.narrative, snapshot.metrics, snapshot.context);
    const statuses = record(v.statuses || {});
    const notes = record(v.notes || {});
    for (const action of snapshot.narrative.actions) {
      const oldId = `action-${snapshot.narrative.actions.indexOf(action) + 1}`;
      const status = statuses[action.id] ?? statuses[oldId];
      snapshot.statuses[action.id] = ['To do', 'In progress', 'Done'].includes(
        String(status),
      )
        ? String(status)
        : 'To do';
      snapshot.notes[action.id] =
        notes[action.id] || notes[oldId]
          ? string(notes[action.id] ?? notes[oldId], 1000)
          : '';
    }
    return snapshot;
  });
}

/** Preserve legacy-language content as bounded, inert text; never regenerate it as English. */
function validateLegacy(value: unknown): Narrative {
  const v = record(value);
  return {
    summary: string(v.summary, 1500),
    findings: [],
    actions: [],
    internal: string(v.internal, 7000),
    citizen: string(v.citizen, 5000),
    translated: string(v.translated, 5000),
  };
}
