import type { Context, Dataset, Metric, Snapshot } from './types';
export { sampleNarrative } from './narrative';
export const siteKey = (site: string) => site.trim().toLowerCase().replace(/\s+/g, ' ');
export function windowOf(dataset: Dataset) {
  const times = dataset.observations
    .filter((o) => o.included)
    .map((o) => Date.parse(o.timestamp))
    .filter(Number.isFinite);
  return times.length ? { start: Math.min(...times), end: Math.max(...times) } : null;
}
export function selectBaseline(
  history: Snapshot[],
  context: Context,
  dataset: Dataset,
  id = '',
) {
  const current = windowOf(dataset);
  const candidates = history.filter(
    (s) =>
      !s.legacyLanguage &&
      s.mode === 'live' &&
      s.context.locality.trim().toLowerCase() === context.locality.trim().toLowerCase() &&
      s.context.timezone === context.timezone &&
      windowOf(s.dataset) &&
      current &&
      windowOf(s.dataset)!.end < current.start,
  );
  return (id ? candidates.filter((s) => s.id === id) : candidates).sort(
    (a, b) => windowOf(b.dataset)!.end - windowOf(a.dataset)!.end,
  )[0];
}
/** Compare local-time sample slots AND relative day offsets, not just equal counts. */
function slots(rows: Dataset['observations'], timezone: string): string {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = rows.map((r) => {
    const parts = Object.fromEntries(
      format.formatToParts(new Date(r.timestamp)).map((p) => [p.type, p.value]),
    );
    return {
      day: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
    };
  });
  const first = Math.min(...values.map((v) => v.day));
  return values
    .map((v) => `${(v.day - first) / 86400000}/${v.time}`)
    .sort()
    .join('|');
}
export function analyze(
  dataset: Dataset,
  context: Context,
  baseline?: Pick<Snapshot, 'context' | 'dataset' | 'metrics'> | null,
): Metric[] {
  const groups = new Map<string, Dataset['observations']>();
  for (const o of dataset.observations) {
    if (!o.included || o.value === null || o.unit !== 'µg/m³') continue;
    const key = JSON.stringify([
      siteKey(o.site),
      o.pollutant,
      o.period.trim().toLowerCase(),
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  const window = windowOf(dataset),
    priorWindow = baseline ? windowOf(baseline.dataset) : null;
  const compatible =
    baseline &&
    window &&
    priorWindow &&
    priorWindow.end < window.start &&
    siteKey(baseline.context.locality) === siteKey(context.locality) &&
    baseline.context.timezone === context.timezone;
  return [...groups.values()]
    .map((rows, i) => {
      const values = rows.map((r) => r.value!),
        mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const previous = compatible
        ? baseline.metrics.find(
            (m) =>
              siteKey(m.site) === siteKey(rows[0].site) &&
              m.pollutant === rows[0].pollutant &&
              m.period.toLowerCase() === rows[0].period.toLowerCase(),
          )
        : undefined;
      const priorRows = previous
        ? baseline!.dataset.observations.filter((o) =>
            previous.observationIds.includes(o.id),
          )
        : [];
      const same =
        !!previous &&
        previous.count === rows.length &&
        slots(rows, context.timezone) === slots(priorRows, context.timezone);
      return {
        id: `metric-${i + 1}`,
        site: rows[0].site,
        pollutant: rows[0].pollutant,
        period: rows[0].period,
        mean,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        observationIds: rows.map((r) => r.id),
        delta: same ? mean - previous!.mean : null,
        previous: same ? previous!.mean : undefined,
        comparison: same
          ? 'Matched sample counts, local times and relative reporting days; observational change, not causation.'
          : previous
            ? 'Not comparable: sample coverage or reporting slots differ.'
            : baseline
              ? 'No compatible earlier baseline for this site/window.'
              : 'First brief: no earlier baseline selected.',
      };
    })
    .sort(
      (a, b) =>
        a.pollutant.localeCompare(b.pollutant) ||
        a.period.localeCompare(b.period) ||
        b.mean - a.mean,
    );
}
