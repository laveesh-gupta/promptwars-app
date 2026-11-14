# Performance measurements

Recorded 2026-11-14T07:15:17.944Z. Node v25.4.0, darwin arm64, Apple M4.

50 measured runs per task after 10 warmups; median and empirical p95 in milliseconds. TypeScript module loading is outside measured loops. Fixtures are generated locally and contain no personal data. This measures pure Node domain work, not browser rendering, networking, or Gemini latency.

| Operation                   | Median ms | p95 ms |
| --------------------------- | --------: | -----: |
| Parse 20 source rows        |      0.05 |   0.07 |
| Parse 500 source rows       |      0.99 |   1.18 |
| Analyze 2,000 observations  |      0.68 |   0.82 |
| Validate 2,000 observations |      1.55 |   1.96 |

Browser responsiveness/bundle and provider comparative benchmarks remain separate checks; these results do not establish their performance.

## Dashboard follow-up — 14 November 2026

The dashboard adds a pure `explore` benchmark to `npm run benchmark`. In the implementation run, 2,000-observation exploration (including creation of original metrics in the timed callback) measured median 1.53 ms and p95 1.67 ms. Parse-500 p95 was 1.10 ms; analyze-2,000 p95 was 0.74 ms. Same 50-run/10-warmup methodology as above.

One Chromium 2,000-observation/500-line fixture opened in 45 ms and filtered to 200 observations in 41 ms, including Playwright overhead. It verifies bounded interaction, not a stable benchmark or heap budget. Local static-chunk allocation was 676 KiB before and 696 KiB after the first dashboard build; those are filesystem allocations, not transferred bundle sizes. No runtime chart library was added.
