import { finalizeDataset } from './normalize';
import { actionId } from './narrative';
import type { Metric, Context, Dataset, Narrative, Snapshot } from './types';
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 4000): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error('Invalid or oversized text field.');
  return value;
}
export function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error('Invalid or oversized collection.');
  return value;
}
export function validateContext(value: unknown): Context {
  const v = record(value);
  const locality = string(v.locality, 120).trim();
  const timezone = string(v.timezone, 80);
  if (!locality) throw new Error('Enter a locality.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new Error('Use a valid IANA timezone.');
  }
  if (
    !['Ward officer', 'Housing society', 'School'].includes(String(v.role)) ||
    !['English', 'Hindi'].includes(String(v.language)) ||
    !['Simple', 'Standard'].includes(String(v.level))
  )
    throw new Error('Invalid context options.');
  return {
    locality,
    timezone,
    role: v.role as Context['role'],
    language: v.language as Context['language'],
    level: v.level as Context['level'],
  };
}
export function validateDataset(value: unknown): Dataset {
  const v = record(value);
  const ids = new Set<string>();
  const observations = array(v.observations, 2000).map((raw) => {
    const o = record(raw);
    const id = string(o.id, 80);
    if (!id || ids.has(id)) throw new Error('Observation IDs must be unique.');
    ids.add(id);
    if (
      typeof o.line !== 'number' ||
      !Number.isInteger(o.line) ||
      o.line < 1 ||
      o.line > 501 ||
      (o.value !== null && (typeof o.value !== 'number' || !Number.isFinite(o.value))) ||
      typeof o.included !== 'boolean'
    )
      throw new Error('Invalid observation fields.');
    return {
      id,
      line: o.line,
      source: string(o.source, 10000),
      site: string(o.site, 120),
      pollutant: string(o.pollutant, 30),
      value: o.value as number | null,
      unit: string(o.unit, 40),
      timestamp: string(o.timestamp, 80),
      period: string(o.period, 80),
      status: o.status === undefined ? '' : string(o.status, 80),
      originalValue:
        o.originalValue === undefined
          ? (o.value as number | null)
          : o.originalValue === null
            ? null
            : typeof o.originalValue === 'number' && Number.isFinite(o.originalValue)
              ? o.originalValue
              : (() => {
                  throw new Error('Invalid original value');
                })(),
      originalUnit:
        o.originalUnit === undefined ? string(o.unit, 40) : string(o.originalUnit, 40),
      correction: o.correction === undefined ? '' : string(o.correction, 500),
      outlierApproved: o.outlierApproved === true,
      flags: array(o.flags || [], 20)
        .map((f) => string(f, 200))
        .filter((f) => f.startsWith('Converted')),
      included: o.included,
      reason: string(o.reason, 500),
    };
  });
  return finalizeDataset({
    label: string(v.label, 200),
    observations,
    notes: array(v.notes, 20).map((n) => string(n, 500)),
    fingerprint:
      typeof v.fingerprint === 'string' ? string(v.fingerprint, 100) : undefined,
    unaccounted:
      v.unaccounted === undefined
        ? []
        : array(v.unaccounted, 501).map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 501)
              throw new Error('Invalid source accounting');
            return n;
          }),
  });
}
export function validateNarrative(
  value: unknown,
  evidence: string[] | Metric[],
  context?: Context,
): Narrative {
  const v = record(value);
  const metrics: Metric[] = evidence.filter((m): m is Metric => typeof m !== 'string');
  const allowed = evidence.map((m) => (typeof m === 'string' ? m : m.id));
  const refs = (value: unknown) =>
    array(value, 20).map((r) => {
      const id = string(r, 80);
      if (!allowed.includes(id)) throw new Error('Unknown evidence reference.');
      return id;
    });
  const findings = array(v.findings, 8).map((raw) => {
    const f = record(raw),
      ids = refs(f.evidence);
    if (!ids.length) throw new Error('Findings require evidence.');
    const assertion = f.assertion === undefined ? 'observation' : string(f.assertion, 30);
    if (!['observation', 'increase', 'decrease', 'highest'].includes(assertion))
      throw new Error('Unknown assertion.');
    if (metrics.length)
      for (const id of ids) {
        const metric = metrics.find((m) => m.id === id)!;
        if (
          (assertion === 'increase' && !(metric.delta !== null && metric.delta > 0)) ||
          (assertion === 'decrease' && !(metric.delta !== null && metric.delta < 0))
        )
          throw new Error('Contradictory change claim.');
        if (
          assertion === 'highest' &&
          metrics.some(
            (m) =>
              m.pollutant === metric.pollutant &&
              m.period === metric.period &&
              m.mean > metric.mean,
          )
        )
          throw new Error('Contradictory ranking claim.');
      }
    return {
      title: string(f.title, 160),
      detail: string(f.detail, 1500),
      limitation: string(f.limitation, 1000),
      evidence: ids,
      assertion: assertion as Narrative['findings'][number]['assertion'],
    };
  });
  const usedActionIds = new Set<string>();
  const actions = array(v.actions, 6).map((raw) => {
    const a = record(raw);
    const item = {
      title: string(a.title, 160),
      owner: string(a.owner, 160),
      rationale: string(a.rationale, 1000),
      verification: string(a.verification, 1000),
      horizon: string(a.horizon, 100),
      evidence: refs(a.evidence),
      location: a.location === undefined ? '' : string(a.location, 160),
      escalation: a.escalation === undefined ? '' : string(a.escalation, 500),
      basis:
        a.basis === 'Observation'
          ? ('Observation' as const)
          : a.basis === 'Data repair'
            ? ('Data repair' as const)
            : ('Guidance' as const),
    };
    if (
      /\p{N}/u.test(item.horizon) &&
      !/^(?:within\s+)?\d+(?:[-–]\d+)?\s+(?:hours?|days?|weeks?)$/i.test(item.horizon)
    )
      throw new Error('Numeric horizons must be simple action durations.');
    if (
      !item.title.trim() ||
      !item.owner.trim() ||
      !item.verification.trim() ||
      !item.rationale.trim()
    )
      throw new Error('Incomplete action.');
    const baseId =
      typeof a.id === 'string' && a.id.startsWith('action-')
        ? string(a.id, 100)
        : actionId(item);
    let id = baseId;
    let suffix = 2;
    while (usedActionIds.has(id)) id = `${baseId}-${suffix++}`;
    usedActionIds.add(id);
    return {
      ...item,
      id,
    };
  });
  if (!actions.length) throw new Error('No actions returned.');
  const result = {
    summary: string(v.summary, 1500),
    findings,
    actions,
    internal: string(v.internal, 7000),
    citizen: string(v.citizen, 5000),
    translated: string(v.translated, 5000),
    internalTranslated:
      v.internalTranslated === undefined ? undefined : string(v.internalTranslated, 7000),
  };
  const prose = [
    result.summary,
    result.internal,
    result.citizen,
    result.translated,
    result.internalTranslated || '',
    ...findings.flatMap((f) => [f.title, f.detail, f.limitation]),
    ...actions.flatMap((a) => [
      a.title,
      a.rationale,
      a.verification,
      a.owner,
      a.location,
    ]),
  ];
  for (const text of prose) {
    const clean = text.replace(
      /\{\{(metric-\d+)\.(mean|min|max|count|delta)\}\}/g,
      (_, id, field) => {
        if (
          !allowed.includes(id) ||
          (field === 'delta' &&
            metrics.length &&
            metrics.find((m) => m.id === id)?.delta === null)
        )
          throw new Error('Invalid fact placeholder.');
        return '';
      },
    );
    const literals = [
      context?.locality || '',
      ...metrics.map((m) => m.site),
      ...allowed,
      ...actions.map((a) => a.horizon),
    ].filter(Boolean);
    const withoutNames = literals.reduce((t, name) => t.split(name).join(''), clean);
    if (
      /\{\{|\}\}/.test(clean) ||
      /\p{N}/u.test(
        withoutNames.replace(
          /(?:PM|पीएम)\s*(?:2[.,]5|10)|[µμu]g\s*\/\s*m(?:³|\^?3)/gi,
          '',
        ),
      )
    )
      throw new Error(
        `Numerical claims must use verified fact placeholders (field ${prose.indexOf(text)}).`,
      );
  }
  return result;
}
export function validateSnapshot(value: unknown): Snapshot {
  const v = record(value);
  if (![1, 2].includes(Number(v.version)) || !['sample', 'live'].includes(String(v.mode)))
    throw new Error('Unsupported history version.');
  if (!Number.isFinite(Date.parse(string(v.created, 100))))
    throw new Error('Invalid snapshot date.');
  const originalContext = record(v.context);
  const legacyLanguage =
    originalContext.language === 'Marathi' || v.legacyLanguage === 'Marathi'
      ? ('Marathi' as const)
      : undefined;
  const context = validateContext({
    ...originalContext,
    language: legacyLanguage ? 'English' : originalContext.language,
  });
  const dataset = validateDataset(v.dataset);
  // Recompute imported metrics separately; never trust imported arithmetic.
  return {
    version: v.version as 1 | 2,
    legacyLanguage,
    id: string(v.id, 100),
    created: string(v.created, 100),
    context,
    dataset,
    baseline: v.baseline
      ? {
          context: validateContext({
            ...record(record(v.baseline).context),
            language:
              record(record(v.baseline).context).language === 'Marathi'
                ? 'English'
                : record(record(v.baseline).context).language,
          }),
          dataset: validateDataset(record(v.baseline).dataset),
        }
      : undefined,
    metrics: [],
    narrative: record(v.narrative) as unknown as Narrative,
    mode: v.mode as 'sample' | 'live',
    statuses: {},
    notes: {},
    followUp:
      v.followUp === undefined
        ? []
        : array(v.followUp, 12).map((raw) => {
            const task = record(raw);
            return {
              id: string(task.id, 100),
              title: string(task.title, 160),
              owner: string(task.owner, 160),
              location: string(task.location, 160),
              status: string(task.status, 40),
              note: string(task.note, 1000),
            };
          }),
  };
}
