# VayuManak v2 — verification record

Verified locally on 14 November 2026 in `/Users/lg5/promptwars-app`. The user authorized implementation. No GitHub push, Vercel deployment, or fresh evaluator score was performed.

## Evidence provenance

The checks refer to the local, uncommitted v2 working tree. No commit identifier or successful remote CI run was recorded. No application checks were rerun for this documentation-only update.

| Evidence                         | Location                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| Domain/API assertions            | `scripts/test.cjs`                                              |
| Browser journeys                 | `tests/workspace.spec.ts` and `playwright.config.ts`            |
| Configured CI                    | `.github/workflows/verify.yml`                                  |
| Real Gemini check                | `scripts/smoke.cjs` (default: two calls; `--roles`: four calls) |
| Reproducible performance fixture | `scripts/benchmark.cjs` and `docs/performance.md`               |
| Remaining product work           | `TODO.md`                                                       |

The local scan checked 10 built client files and found no occurrence of the configured key. It does not certify every possible log, server artifact or future deployment.

## Automated evidence

| Check                          | Result                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatter                      | Passed; source, CSS, scripts, tests, configuration and docs                                                                                   |
| ESLint                         | Passed                                                                                                                                        |
| TypeScript                     | Passed as part of production build; standalone check also available                                                                           |
| Domain/API regressions         | 25 passed                                                                                                                                     |
| Production build               | Passed; static `/`, dynamic `/api/generate`                                                                                                   |
| Production-browser regressions | 4 passed in Chromium, 2.6 seconds on final run                                                                                                |
| Live Gemini                    | Extraction and validated briefing passed with fictional data; per-role successes and intermittent upstream failures recorded in AI evaluation |
| Production dependency audit    | Zero known production vulnerabilities reported by `npm audit --omit=dev` at review time                                                       |
| Local performance              | Reproducible 50-run measurements in performance.md; no browser/provider performance claim inferred                                            |

The browser suite checks all three role paths, next-period notes, evidence dialog and Escape focus return, English/Hindi document switching, reading-level continuity, 390px navigation/no page overflow, hidden upload controls, and saved-note refresh/restoration. Tests use sample mode and do not consume provider quota. CI includes these checks after building the production app.

## Manual browser evidence

Using Brave's native UI, observed:

- Fictional Bhopal sample, redesigned desktop action desk and different school/society/ward recommendations.
- A school verification note carried into period two; market +34 and school -18 µg/m³, while the society coverage gap blocks a trend.
- Source dialog with original observations, calculation, exclusions and fingerprint; Escape returned focus to its opener.
- Citizen and internal note views in Hindi, preserving displayed observation values.
- Mobile navigation and source review at a confirmed 390px device width.
- Selected Hindi internal-note print preview: one page, with document/evidence/guidance and without the action desk/navigation. No physical printing or file publication occurred.

Manual review found a hidden-input CSS override, which was corrected and covered by the browser suite. The saved-note test initially appeared to lose a value, but storage diagnostics confirmed the note was intact; an implicit-label locator was selecting the empty sibling. An explicit accessible name fixes that ambiguity and the test passes.

## Important boundaries and remaining gates

- Hindi is a draft awaiting the user's natural-language review; correct rendering is not fluency acceptance.
- Exhaustive accessibility/contrast/screen-reader audits, the full 24-variant output matrix and candidate-model comparison remain open. Four browser scenarios are not exhaustive testing.
- Native test coverage observes transpiled TypeScript; no claim of 90% source-level branch coverage is made.
- Public deployment firewall/rate-limit capabilities, environment scope and live deployed smoke testing remain unverified. Origin checks and cooldown are not distributed rate limiting.
- The dependency install reports moderate development-tool findings; the production-only audit is clean. No blind major dependency upgrades were performed.
- Extraction verifies line provenance and numerical presence, not arbitrary semantic correctness of all mappings. Free model prose still requires human review.
- No 98+ score is claimed; independent evaluation is required. The stricter acceptance plan retains unchecked gates rather than retroactively declaring them passed.

See TODO.md for implemented work and outstanding acceptance tasks, and hindi-review.md for the user review checklist.

## Dashboard implementation — 14 November 2026

- Production build (including TypeScript), formatting and ESLint pass. 28 domain/API tests and six Chromium journeys pass, including all four original journeys.
- New regressions cover tied/zero/single-site priority, mixed pollutant groups, unknown confirmations, immutable source snapshots, partial-window delta suppression, excluded-record visibility and action/concentration independence. Existing fixtures cover duplicates, outliers, missing/zero and zero baselines.
- Browser dashboard journey verifies local filtering without provider requests, confirmed scoring, source-dialog navigation and no horizontal overflow at 390px. Desktop and mobile full-page screenshots were inspected; local artifacts are under `test-results/workspace-dashboard-filter-379cc-e-stay-local-and-accessible/` (Git-ignored).
- Visual inspection caught ambiguous excluded timestamps distorting the timeline; timeline/options now use the parser's strict timestamp validator. Those records remain in quality inspection and unknown-time matrix bins.
- A synthetic 2,000-observation / 500-source-line snapshot opened in 45 ms and filtered to 200 observations in 41 ms in one Chromium run. These wall times include Playwright interactions/waits; this is a smoke measurement, not a statistically established rendering budget. No browser heap or provider latency claim is made.
- Node benchmark (50 measured runs, ten warmups): parse 500 rows p95 1.10 ms; analyze 2,000 observations p95 0.74 ms; explore 2,000 observations p95 1.67 ms (includes constructing the fixture's original metrics). Recorded Node v25.4.0, Darwin arm64, Apple M4. Existing baseline measurements remain in performance.md.
- Local `.next/static/chunks` directory allocation changed from 676 KiB before implementation to 696 KiB after the first dashboard production build. This is filesystem allocation, not gzip, route transfer size or a controlled before/after benchmark. No chart dependency was added.
- New chart foreground contrast on warm paper (`#fffdf7`): forest 8.17:1, teal 4.90:1, indigo 6.38:1, amber marker 3.52:1. Amber is a graphical marker, not small text. This does not constitute an exhaustive audit of existing styles or overlapping graphics.

Limits remain explicit: context confirmations are temporary exploration state with scoped text export, not durable intake/history fields. New dashboard controls are English. Partial-time comparisons are conservatively unavailable; no inferred partial baseline is supplied. Weight validation with an independent reviewer, full screen-reader/zoom/contrast checks, Hindi approval, broader model tests, deployed protections and independent scoring remain open. Nothing was pushed or deployed.
