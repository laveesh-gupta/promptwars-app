import { analyze, siteKey } from './analyze';
import { validTimestamp } from './normalize';
import type { Metric, Snapshot } from './types';

export type ExplorationFilter = {
  group: string;
  sites: string[];
  start: string;
  end: string;
};
export type SiteConfirmation = {
  sensitive: '' | 'yes' | 'no';
  remit: '' | 'yes' | 'no';
  rationale: string;
  siteType: string;
  affectedGroups: string;
  conditions: string;
};
export const groupKey = (m: { pollutant: string; period: string }) =>
  JSON.stringify([m.pollutant, m.period.trim().toLowerCase()]);
export const emptyConfirmation: SiteConfirmation = {
  sensitive: '',
  remit: '',
  rationale: '',
  siteType: '',
  affectedGroups: '',
  conditions: '',
};

/** A view of a successful snapshot. Never writes back to its observations or narrative. */
export function explore(brief: Snapshot, filter: ExplorationFilter) {
  const start = filter.start ? Date.parse(filter.start) : -Infinity;
  const end = filter.end ? Date.parse(filter.end) : Infinity;
  const rows = brief.dataset.observations.filter(
    (o) =>
      (!filter.group || groupKey(o) === filter.group) &&
      (!filter.sites.length || filter.sites.includes(siteKey(o.site))) &&
      ((!filter.start && !filter.end) ||
        (validTimestamp(o.timestamp) &&
          Date.parse(o.timestamp) >= start &&
          Date.parse(o.timestamp) <= end)),
  );
  const dataset = { ...brief.dataset, observations: rows };
  const baseline = brief.baseline
    ? {
        ...brief.baseline,
        metrics: analyze(brief.baseline.dataset, brief.baseline.context),
      }
    : undefined;
  let metrics = analyze(dataset, brief.context, baseline);
  // A partial current window cannot borrow the full baseline's matched delta.
  if (filter.start || filter.end)
    metrics = metrics.map((m) => ({
      ...m,
      delta: null,
      previous: undefined,
      comparison:
        'Not comparable: partial time selection; select the full reporting window to re-check matched slots.',
    }));
  // Evidence references continue to identify saved source groups, even after sorting/filtering.
  metrics = metrics.map((m) => ({
    ...m,
    id:
      brief.metrics.find(
        (original) =>
          siteKey(original.site) === siteKey(m.site) &&
          groupKey(original) === groupKey(m),
      )?.id || m.id,
  }));
  const usable = rows.filter(
    (o) => o.included && o.value !== null && o.unit === 'µg/m³',
  ).length;
  const unresolved = rows.filter((o) => o.value === null).length;
  const excluded = rows.length - usable - unresolved;
  const unaccounted = brief.dataset.unaccounted?.length || 0;
  const verificationSites = new Set(
    rows.filter((o) => !o.included || o.value === null).map((o) => siteKey(o.site)),
  );
  metrics
    .filter((m) => m.delta === null)
    .forEach((m) => verificationSites.add(siteKey(m.site)));
  return {
    rows,
    metrics,
    usable,
    unresolved,
    excluded,
    unaccounted,
    usability: rows.length ? (100 * usable) / rows.length : null,
    verificationSites: verificationSites.size,
  };
}

export function priority(
  metric: Metric,
  peers: Metric[],
  confirmation: SiteConfirmation,
) {
  const compatible = peers.filter((m) => groupKey(m) === groupKey(metric));
  const higher = compatible.filter((m) => m.mean > metric.mean).length;
  const equal = compatible.filter((m) => m.mean === metric.mean).length;
  const rank = higher + (equal + 1) / 2;
  const concentration =
    compatible.length > 1
      ? (60 * (compatible.length - rank)) / (compatible.length - 1)
      : null;
  const sensitive = confirmation.sensitive === 'yes' ? 20 : 0;
  const remit = confirmation.remit === 'yes' ? 20 : 0;
  const confirmed =
    !!confirmation.sensitive && !!confirmation.remit && !!confirmation.rationale.trim();
  return {
    rank,
    concentration,
    sensitive,
    remit,
    total: confirmed && concentration !== null ? concentration + sensitive + remit : null,
  };
}

export function actionProgress(brief: Snapshot, actions = brief.narrative.actions) {
  const counts = ['To do', 'In progress', 'Done'].map((status) => ({
    status,
    count: actions.filter((a) => (brief.statuses[a.id] || 'To do') === status).length,
  }));
  return {
    counts,
    total: actions.length,
    percent: actions.length ? (100 * counts[2].count) / actions.length : null,
  };
}
