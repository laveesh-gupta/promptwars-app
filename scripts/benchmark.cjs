/* eslint-disable @typescript-eslint/no-require-imports -- In-memory TypeScript loader for reproducible Node benchmarks. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
};
const { parseTable } = require('../src/lib/air/normalize.ts');
const { analyze } = require('../src/lib/air/analyze.ts');
const { explore } = require('../src/lib/air/dashboard.ts');
const { validateDataset } = require('../src/lib/air/validation.ts');
const { DEFAULT_CONTEXT } = require('../src/lib/air/types.ts');
function table(count) {
  return [
    'site,pollutant,value,unit,timestamp,period,status',
    ...Array.from(
      { length: count },
      (_, i) =>
        `Site ${i % 10},PM2.5,${20 + (i % 90)},ug/m3,2026-11-10T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}+05:30,spot,ok`,
    ),
  ].join('\n');
}
function measure(name, callback) {
  for (let i = 0; i < 10; i++) callback();
  const times = Array.from({ length: 50 }, () => {
    const start = performance.now();
    callback();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return `| ${name} | ${times[25].toFixed(2)} | ${times[47].toFixed(2)} |`;
}
const max = parseTable(table(500));
const wide = {
  ...max,
  observations: Array.from({ length: 4 }, (_, group) =>
    max.observations.map((o) => ({
      ...o,
      id: `${o.id}-${group}`,
      site: `${o.site} group ${group}`,
    })),
  ).flat(),
};
const results = [
  measure('Parse 20 source rows', () => parseTable(table(20))),
  measure('Parse 500 source rows', () => parseTable(table(500))),
  measure('Analyze 2,000 observations', () => analyze(wide, DEFAULT_CONTEXT)),
  measure('Explore 2,000 observations', () =>
    explore(
      {
        dataset: wide,
        context: DEFAULT_CONTEXT,
        metrics: analyze(wide, DEFAULT_CONTEXT),
      },
      { group: '', sites: [], start: '', end: '' },
    ),
  ),
  measure('Validate 2,000 observations', () => validateDataset(wide)),
];
const report = `# Performance measurements\n\nRecorded ${new Date().toISOString()}. Node ${process.version}, ${os.platform()} ${os.arch()}, ${os.cpus()[0]?.model}.\n\n50 measured runs per task after 10 warmups; median and empirical p95 in milliseconds. TypeScript module loading is outside measured loops. Fixtures are generated locally and contain no personal data. This measures pure Node domain work, not browser rendering, networking, or Gemini latency.\n\n| Operation | Median ms | p95 ms |\n| --- | ---: | ---: |\n${results.join('\n')}\n\nBrowser responsiveness/bundle and provider comparative benchmarks remain separate checks; these results do not establish their performance.\n`;
console.log(report);
if (process.argv.includes('--write'))
  fs.writeFileSync(path.join(root, 'docs/performance.md'), report);
