import type { Dataset, Observation } from './types';

/** Stable non-security identifier. Original source excerpts remain the audit authority. */
export function fingerprint(text: string): string {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
export function sourceLines(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((source, i) => ({ line: i + 1, source }))
    .filter((row) => row.source.trim());
}
export function checkSource(text: string) {
  if (!text.trim()) throw new Error('Paste or upload a table first.');
  if (
    new TextEncoder().encode(text).length > 102400 ||
    text.split(/\r\n?|\n/).length > 501
  )
    throw new Error(
      'Use at most 100 KB and 500 data rows (501 physical lines including headers).',
    );
}
export function delimiterFor(line: string): string {
  const counts = new Map([
    ['\t', 0],
    [';', 0],
    [',', 0],
  ]);
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && counts.has(line[i]))
      counts.set(line[i], counts.get(line[i])! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}
export function cells(line: string, delimiter = delimiterFor(line)): string[] {
  const result: string[] = [];
  let cell = '',
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      result.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  if (quoted)
    throw new Error(
      'Unclosed quote: multiline CSV records are unsupported. Use one observation per line.',
    );
  result.push(cell.trim());
  return result;
}
export function validTimestamp(text: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      text,
    );
  if (!match) return false;
  const [, y, m, d, h, min, sec = '0', offset] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    year >= 1900 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= maxDay &&
    Number(h) < 24 &&
    Number(min) < 60 &&
    Number(sec) < 60 &&
    (offset === 'Z' ||
      (Number(offset.slice(1, 3)) <= 14 &&
        Number(offset.slice(4)) < 60 &&
        (Number(offset.slice(1, 3)) < 14 || offset.slice(4) === '00'))) &&
    Number.isFinite(Date.parse(text))
  );
}
export function normalizeObservation(row: Observation): Observation {
  const flags =
    row.unit === 'µg/m³' ? row.flags.filter((f) => f.startsWith('Converted')) : [];
  let value = row.value;
  const unit = row.unit
    .toLowerCase()
    .replace(/μ|µ/g, 'u')
    .replace(/³/g, '3')
    .replace(/\s|\^/g, '');
  const known = ['mg/m3', 'ug/m3'].includes(unit);
  if (unit === 'mg/m3') {
    if (value !== null) value *= 1000;
    flags.push('Converted mg/m³ × 1,000');
  } else if (!known) flags.push('Unresolved unit');
  if (value === null) flags.push('Missing value');
  else if (!Number.isFinite(value) || value < 0) flags.push('Invalid value');
  else if (value > 1000 && !(row.outlierApproved && row.reason.trim()))
    flags.push('Review unusually high reading');
  if (!validTimestamp(row.timestamp))
    flags.push('Unresolved timestamp: use an exact ISO date with offset');
  if (!['PM2.5', 'PM10'].includes(row.pollutant)) flags.push('Unsupported pollutant');
  if (!row.site.trim()) flags.push('Missing site');
  if (!row.period.trim()) flags.push('Missing averaging period');
  if (/^(outage|offline|error|fault)$/i.test(row.status || ''))
    flags.push('Sensor flagged offline/error');
  return {
    ...row,
    value,
    unit: known ? 'µg/m³' : row.unit,
    flags,
    originalValue: row.originalValue === undefined ? row.value : row.originalValue,
    originalUnit: row.originalUnit ?? row.unit,
    included: row.included && !flags.some((f) => !f.startsWith('Converted')),
  };
}
export function finalizeDataset(dataset: Dataset): Dataset {
  const seen = new Set<string>();
  return {
    ...dataset,
    observations: dataset.observations.map((row) => {
      const o = normalizeObservation(row);
      const key = JSON.stringify([
        o.site.trim().toLowerCase(),
        o.pollutant,
        Date.parse(o.timestamp),
        o.period.trim().toLowerCase(),
        o.value,
        o.unit,
      ]);
      if (seen.has(key))
        return { ...o, included: false, flags: [...o.flags, 'Duplicate observation'] };
      // An excluded row must not prevent a corrected, included replacement from being used.
      if (o.included) seen.add(key);
      return o;
    }),
  };
}
export function parseTable(text: string, label = 'Pasted readings'): Dataset {
  checkSource(text);
  const lines = sourceLines(text),
    delimiter = delimiterFor(lines[0].source);
  const header = cells(lines[0].source, delimiter).map((c) => c.toLowerCase());
  const required = ['site', 'pollutant', 'value', 'unit', 'timestamp', 'period'];
  if (!required.every((h) => header.includes(h)))
    throw new Error(
      'Local review needs site, pollutant, value, unit, timestamp, period columns. Use Gemini to interpret other formats.',
    );
  const observations = lines
    .slice(1)
    .filter(
      (r) => cells(r.source, delimiter).join('|').toLowerCase() !== header.join('|'),
    )
    .map((r) => {
      const fields = cells(r.source, delimiter);
      const get = (name: string) => fields[header.indexOf(name)] || '';
      const raw = get('value'),
        n = Number(raw.replace(',', '.'));
      const value = !raw || /^(NA|null|-)$/i.test(raw) || !Number.isFinite(n) ? null : n;
      return {
        id: `row-${r.line}`,
        line: r.line,
        source: r.source,
        site: get('site'),
        pollutant: get('pollutant').toUpperCase(),
        value,
        unit: get('unit'),
        timestamp: get('timestamp'),
        period: get('period'),
        status: get('status'),
        flags: [],
        included: true,
        reason: '',
        correction: '',
      };
    });
  return finalizeDataset({
    label,
    observations,
    notes: [
      'Expected sampling coverage is unknown unless a cadence is independently confirmed.',
    ],
    fingerprint: fingerprint(text),
    unaccounted: [],
  });
}
