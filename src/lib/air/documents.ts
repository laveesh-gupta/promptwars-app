import type { Metric, Snapshot } from './types';
import { GUIDANCE } from './types';
export function formatNumber(value: number) {
  return Number(value.toFixed(1)).toLocaleString('en-IN');
}
export function renderFacts(text: string, metrics: Metric[]) {
  return text.replace(
    /\{\{(metric-\d+)\.(mean|min|max|count|delta)\}\}/g,
    (_, id, field: keyof Metric) => {
      const value = metrics.find((m) => m.id === id)?.[field];
      return typeof value === 'number' ? formatNumber(value) : '—';
    },
  );
}
export function documentText(
  snapshot: Snapshot,
  kind: 'citizen' | 'internal',
  language: 'English' | 'Hindi',
) {
  const n = snapshot.narrative;
  const prose =
    kind === 'internal'
      ? language === 'Hindi'
        ? n.internalTranslated ||
          'Hindi internal note is unavailable for this legacy brief.'
        : n.internal
      : language === 'Hindi'
        ? n.translated
        : n.citizen;
  const evidence = snapshot.metrics
    .map(
      (m) =>
        `${m.id} · ${m.site} · ${m.pollutant} · ${m.period}: ${formatNumber(m.mean)} µg/m³ (n=${m.count})`,
    )
    .join('\n');
  return `${snapshot.context.locality}\n${kind === 'internal' ? 'Internal briefing note' : 'Citizen advisory'} · ${snapshot.context.level} · ${snapshot.mode === 'sample' ? 'FICTIONAL SAMPLE' : 'Live brief'}\n${renderFacts(prose, snapshot.metrics)}\n\nEvidence / साक्ष्य\n${evidence}\n\nGuidance / मार्गदर्शन: ${GUIDANCE.url}\nExpected coverage unknown. No official AQI; no source or causal attribution.\n`;
}
