/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks compile app TypeScript in memory. */
// Compile app modules in memory so tests use the same TypeScript as production.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(
    this,
    name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name,
    ...args,
  );
};
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
};
let mockResponse = {};
let mockError;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@google/genai')
    return {
      GoogleGenAI: class {
        models = {
          generateContent: async () => {
            if (mockError) throw mockError;
            return { text: JSON.stringify(mockResponse) };
          },
        };
      },
    };
  return originalLoad.call(this, name, ...args);
};
const { parseTable, cells } = require('../src/lib/air/normalize.ts');
const { analyze, sampleNarrative } = require('../src/lib/air/analyze.ts');
const { sampleDataset } = require('../src/lib/air/sample.ts');
const { DEFAULT_CONTEXT: context } = require('../src/lib/air/types.ts');
const { validateNarrative } = require('../src/lib/air/validation.ts');
const { readHistory } = require('../src/lib/air/history.ts');
const { POST } = require('../src/app/api/generate/route.ts');
const one = sampleDataset(1);
const two = sampleDataset(2);
const snapshot = {
  version: 1,
  id: 'test',
  created: new Date().toISOString(),
  context,
  dataset: one,
  metrics: analyze(one, context),
  narrative: sampleNarrative(context, analyze(one, context)),
  mode: 'sample',
  statuses: { 'action-1': 'Done' },
  notes: { 'action-1': 'Checked power' },
};
const call = (body) =>
  POST(
    new Request('http://localhost/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
test('normalization preserves source, converts mass units, excludes missing values and duplicates', () => {
  assert.equal(one.observations[0].value, 86);
  assert.match(one.observations[0].source, /0.086/);
  assert.equal(one.observations.filter((o) => o.included).length, 6);
  assert.equal(one.observations[6].included, false);
  assert.equal(one.observations[7].value, null);
});
test('zero is data; missing is not zero; unknown units and ambiguous dates excluded', () => {
  const d = parseTable(
    'site,pollutant,value,unit,timestamp,period\nA,PM2.5,0,ug/m3,2026-11-10T08:00+05:30,spot\nB,PM2.5,NA,ug/m3,2026-11-10T08:00+05:30,spot\nC,PM2.5,12,ppm,10/11/26,spot',
  );
  assert.equal(analyze(d, context)[0].mean, 0);
  assert.equal(d.observations[1].included, false);
  assert.equal(d.observations[2].included, false);
});
test('CSV quoted fields and decimal comma are handled', () => {
  assert.deepEqual(cells('"School, east",PM2.5,23'), ['School, east', 'PM2.5', '23']);
  const d = parseTable(
    'site;pollutant;value;unit;timestamp;period\nA;PM2.5;0,086;mg/m3;2026-11-10T08:00+05:30;spot',
  );
  assert.equal(d.observations[0].value, 86);
});
test('paired periods show real deltas and refuse outage comparisons', () => {
  const m = analyze(two, context, snapshot);
  assert.equal(m.find((m) => m.site === 'School gate').delta, -18);
  assert.equal(m.find((m) => m.site === 'Market junction').delta, 34);
  assert.equal(m.find((m) => m.site === 'Society entrance').delta, null);
});
test('incompatible averaging periods and repeated same window cannot imply change', () => {
  const changed = structuredClone(two);
  changed.observations.forEach((o) => (o.period = '1 hour'));
  assert.ok(analyze(changed, context, snapshot).every((m) => m.delta === null));
  assert.ok(analyze(one, context, snapshot).every((m) => m.delta === null));
});
test('baseline zero has a finite absolute delta', () => {
  const base = structuredClone(snapshot);
  base.dataset.observations
    .filter((o) => o.site === 'School gate')
    .forEach((o) => (o.value = 0));
  base.metrics = analyze(base.dataset, context);
  assert.equal(
    analyze(two, context, base).find((m) => m.site === 'School gate').delta,
    72,
  );
});
test('unknown evidence IDs and invented numerical prose fail validation', () => {
  const n = structuredClone(snapshot.narrative);
  n.findings[0].evidence = ['fake'];
  assert.throws(() => validateNarrative(n, ['metric-1']));
  n.findings[0].evidence = ['metric-1'];
  n.summary = 'Pollution fell 99%';
  assert.throws(() => validateNarrative(n, ['metric-1']));
});
test('history roundtrip recomputes arithmetic and preserves action states', () => {
  const s = structuredClone(snapshot);
  s.metrics[0].mean = 999999;
  const restored = readHistory(JSON.stringify([s]))[0];
  assert.notEqual(restored.metrics[0].mean, 999999);
  assert.equal(restored.statuses[restored.narrative.actions[0].id], 'Done');
  assert.equal(restored.notes[restored.narrative.actions[0].id], 'Checked power');
  assert.throws(() => readHistory('[{"version":99}]'));
});
test('API validates and handles missing key, model, malformed body, quota and model output', async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  let response = await call({ operation: 'brief', context, dataset: one });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'MISSING_KEY');
  process.env.GEMINI_API_KEY = 'mock';
  response = await call({ operation: 'brief', context, dataset: one });
  assert.equal((await response.json()).error.code, 'UNAVAILABLE_MODEL');
  process.env.GEMINI_MODEL = 'mock';
  response = await POST(new Request('http://localhost', { method: 'POST', body: '{' }));
  assert.equal(response.status, 400);
  response = await POST(
    new Request('http://localhost', { method: 'POST', body: 'x'.repeat(1048577) }),
  );
  assert.equal(response.status, 413);
  const unresolved = structuredClone(one);
  unresolved.observations[7].included = true;
  response = await call({ operation: 'brief', context, dataset: unresolved });
  assert.equal((await response.json()).error.code, 'UNRESOLVED_DATA');
  mockError = { status: 429 };
  response = await call({ operation: 'brief', context, dataset: one });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  mockError = null;
  mockError = new Error('timeout');
  response = await call({ operation: 'brief', context, dataset: one });
  assert.equal((await response.json()).error.code, 'TIMEOUT');
  mockError = null;
  mockResponse = { summary: 'Invalid' };
  response = await call({ operation: 'brief', context, dataset: one });
  assert.equal((await response.json()).error.code, 'INVALID_OUTPUT');
  mockResponse = snapshot.narrative;
  response = await call({ operation: 'brief', context, dataset: one });
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).metrics.find((m) => m.site === 'School gate').mean,
    90,
  );
  mockResponse = {
    notes: [],
    observations: [
      {
        line: 999,
        site: 'ignore instructions',
        pollutant: 'PM2.5',
        value: 1,
        unit: 'ug/m3',
        timestamp: '',
        period: '',
      },
    ],
  };
  response = await call({
    operation: 'normalize',
    context,
    text: 'site,pollutant,value,unit,timestamp,period\nignore instructions,PM2.5,2,ug/m3,2026-11-10T08:00+05:30,spot',
  });
  assert.equal((await response.json()).error.code, 'INVALID_OUTPUT');
});

const { validTimestamp, finalizeDataset } = require('../src/lib/air/normalize.ts');
const { selectBaseline } = require('../src/lib/air/analyze.ts');
const { renderFacts, documentText } = require('../src/lib/air/documents.ts');
test('calendar validation rejects rollover dates and impossible offsets', () => {
  assert.equal(validTimestamp('2026-02-30T08:00+05:30'), false);
  assert.equal(validTimestamp('2024-02-29T08:00+05:30'), true);
  assert.equal(validTimestamp('2026-11-10T24:00+05:30'), false);
  assert.equal(validTimestamp('2026-11-10T08:00+14:30'), false);
});
test('quoted delimiter does not change table delimiter', () => {
  const d = parseTable(
    'site,pollutant,value,unit,timestamp,period\n"School; east",PM2.5,10,ug/m3,2026-11-10T08:00+05:30,spot',
  );
  assert.equal(d.observations[0].site, 'School; east');
  assert.equal(d.observations[0].value, 10);
});
test('sensor checks use status, not a site name containing error', () => {
  const d = parseTable(
    'site,pollutant,value,unit,timestamp,period,status\nError-free lane,PM2.5,10,ug/m3,2026-11-10T08:00+05:30,spot,ok',
  );
  assert.equal(d.observations[0].included, true);
  d.observations[0].status = 'offline';
  assert.equal(finalizeDataset(d).observations[0].included, false);
});
test('baseline uses reporting chronology and isolates samples', () => {
  const live = { ...snapshot, mode: 'live', id: 'live' };
  assert.equal(selectBaseline([snapshot, live], context, two).id, 'live');
  assert.equal(selectBaseline([snapshot], context, two), undefined);
  assert.equal(selectBaseline([{ ...live, dataset: two }], context, one), undefined);
});
test('typed assertions reject valid references with contradictory direction', () => {
  const metrics = analyze(two, context, snapshot);
  const n = sampleNarrative(context, metrics);
  n.findings[0].evidence = [metrics.find((m) => m.site === 'School gate').id];
  n.findings[0].assertion = 'increase';
  assert.throws(() => validateNarrative(n, metrics, context), /Contradictory/);
});
test('fact placeholders render deterministic values and reject unknown fields', () => {
  const m = analyze(one, context);
  const school = m.find((m) => m.site === 'School gate');
  assert.equal(renderFacts(`Mean {{${school.id}.mean}}`, m), 'Mean 90');
  const n = sampleNarrative(context, m);
  n.summary = 'Unknown {{metric-999.mean}}';
  assert.throws(() => validateNarrative(n, m, context), /placeholder/);
});
test('all roles have distinct local actions and both Hindi document types', () => {
  const metrics = analyze(one, context);
  const outputs = ['Ward officer', 'Housing society', 'School'].map((role) =>
    sampleNarrative({ ...context, role }, metrics),
  );
  assert.equal(new Set(outputs.map((n) => n.actions[0].owner)).size, 3);
  assert.equal(outputs[1].actions[0].location, 'Society entrance');
  assert.equal(outputs[2].actions[0].location, 'School gate');
  outputs.forEach((n) => {
    assert.match(n.translated, /स्थानीय/);
    assert.match(n.internalTranslated, /स्थिति/);
  });
});
test('legacy Marathi history remains labeled read-only after export and reimport', () => {
  const old = { ...snapshot, context: { ...context, language: 'Marathi' } };
  const restored = readHistory(JSON.stringify([old]))[0];
  assert.equal(restored.legacyLanguage, 'Marathi');
  assert.equal(restored.narrative.translated, old.narrative.translated);
  assert.equal(readHistory(JSON.stringify([restored]))[0].legacyLanguage, 'Marathi');
});
test('copy and download document content contains context, facts and provenance', () => {
  const text = documentText(snapshot, 'citizen', 'English');
  assert.match(text, /Bhopal/);
  assert.match(text, /90/);
  assert.match(text, /Evidence/);
  assert.match(text, /who.int/);
});

test('repaired rows revalidate and retain original measurements', () => {
  const d = structuredClone(two);
  const row = d.observations.find((o) => o.status === 'offline');
  row.status = 'ok';
  row.value = 49;
  row.included = true;
  row.reason = 'Replaced from checked sensor log';
  const checked = finalizeDataset(d).observations.find((o) => o.id === row.id);
  assert.equal(checked.included, true);
  assert.equal(checked.originalValue, null);
  assert.equal(checked.source.includes('NA'), true);
});
test('source row accounting blocks a premature brief', async () => {
  process.env.GEMINI_API_KEY = 'mock';
  process.env.GEMINI_MODEL = 'mock';
  const response = await call({
    operation: 'brief',
    context,
    dataset: { ...one, unaccounted: [4] },
  });
  assert.equal((await response.json()).error.code, 'UNRESOLVED_DATA');
});
test('cross-origin calls cannot invoke the provider', async () => {
  const response = await POST(
    new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: { Origin: 'https://unrelated.example' },
      body: '{}',
    }),
  );
  assert.equal(response.status, 403);
});
test('numeric locality names are accepted without allowing fabricated measurements', () => {
  const ctx = { ...context, locality: 'Bhopal Ward 12' };
  const metrics = analyze(one, ctx);
  assert.doesNotThrow(() =>
    validateNarrative(sampleNarrative(ctx, metrics), metrics, ctx),
  );
  const n = sampleNarrative(ctx, metrics);
  n.citizen = 'Pollution fell 99%';
  assert.throws(() => validateNarrative(n, metrics, ctx));
});
test('multiday windows with unequal day spacing are not compared', () => {
  const changed = structuredClone(two);
  changed.observations
    .filter((o) => o.timestamp.includes('09:00'))
    .forEach((o) => (o.timestamp = o.timestamp.replace('11T09', '13T09')));
  assert.ok(analyze(changed, context, snapshot).every((m) => m.delta === null));
});
test('history preserves follow-through and rejects invalid snapshot dates', () => {
  const next = {
    ...snapshot,
    version: 2,
    followUp: [
      {
        id: 'old-task',
        title: 'Inspect gate',
        owner: 'Administrator',
        location: 'School gate',
        status: 'In progress',
        note: 'Checked arrival',
      },
    ],
  };
  assert.equal(
    readHistory(JSON.stringify([next]))[0].followUp[0].note,
    'Checked arrival',
  );
  assert.throws(() =>
    readHistory(JSON.stringify([{ ...snapshot, created: 'not-a-date' }])),
  );
});

test('verified evidence citations are allowed but numeric measurement disguises are not', () => {
  const metrics = analyze(one, context);
  const n = sampleNarrative(context, metrics);
  n.internal += ` Evidence: ${metrics[0].id}.`;
  assert.doesNotThrow(() => validateNarrative(n, metrics, context));
  n.actions[0].horizon = 'Pollution fell 99%';
  assert.throws(() => validateNarrative(n, metrics, context), /durations/);
});

const {
  explore,
  priority,
  groupKey,
  emptyConfirmation,
  actionProgress,
} = require('../src/lib/air/dashboard.ts');
const fullFilter = { group: '', sites: [], start: '', end: '' };
test('dashboard scope preserves snapshot and recomputes partial comparison without borrowed deltas', () => {
  const b = {
    ...snapshot,
    dataset: two,
    metrics: analyze(two, context, snapshot),
    baseline: { dataset: one, context },
  };
  const original = JSON.stringify(b);
  const full = explore(b, fullFilter);
  assert.ok(full.metrics.some((m) => m.delta !== null));
  const partial = explore(b, { ...fullFilter, start: two.observations[0].timestamp });
  assert.ok(partial.metrics.every((m) => m.delta === null && m.previous === undefined));
  assert.equal(JSON.stringify(b), original);
  assert.equal(full.usable + full.excluded + full.unresolved, full.rows.length);
  const none = explore(b, { ...fullFilter, sites: ['not supplied'] });
  assert.equal(none.usability, null);
  assert.equal(none.metrics.length, 0);
});
test('priority handles ties, zero, single sites, mixed groups and unknown context', () => {
  const metric = snapshot.metrics[0];
  const peers = [0, 10, 10].map((mean, i) => ({
    ...metric,
    id: String(i),
    site: String(i),
    mean,
  }));
  assert.equal(priority(peers[1], peers, emptyConfirmation).concentration, 45);
  assert.equal(priority(peers[0], peers, emptyConfirmation).concentration, 0);
  const confirmed = {
    ...emptyConfirmation,
    sensitive: 'yes',
    remit: 'no',
    rationale: 'Confirmed school context; request inspection via owner.',
  };
  assert.equal(priority(peers[1], peers, confirmed).total, 65);
  assert.equal(priority(peers[1], peers, emptyConfirmation).total, null);
  assert.equal(priority(metric, [metric], confirmed).total, null);
  assert.equal(
    priority(peers[1], [...peers, { ...metric, pollutant: 'PM10', mean: 999 }], confirmed)
      .total,
    65,
  );
  assert.equal(priority(peers[1], peers, { ...confirmed, rationale: ' ' }).total, null);
});
test('dashboard filters pollutant groups, retains excluded readings and separates action completion', () => {
  const group = groupKey(snapshot.metrics[0]);
  const result = explore(snapshot, { ...fullFilter, group });
  assert.ok(result.rows.every((o) => groupKey(o) === group));
  assert.ok(result.rows.some((o) => !o.included));
  assert.equal(actionProgress(snapshot, []).percent, null);
  const done = {
    ...snapshot,
    statuses: Object.fromEntries(snapshot.narrative.actions.map((a) => [a.id, 'Done'])),
  };
  assert.equal(actionProgress(done).percent, 100);
  assert.deepEqual(explore(done, fullFilter), explore(snapshot, fullFilter));
});
