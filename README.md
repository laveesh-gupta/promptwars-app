# VayuManak

**Local evidence. An owner. A next check.**

VayuManak turns messy particulate readings into a local intervention plan for a ward officer, housing society or school. The single-page Bhopal demo connects source review, action ownership, period comparison and English/Hindi communication. Sample readings are fictional; the app does not claim an official AQI, identify a pollution source or prove intervention causality.

## Start

Node.js 22+ is recommended (CI uses 22). Install with `npm ci`, then run `npm run dev` and open http://localhost:3000.

**Load Sample Data** works without a key. Try all three roles, record a verification note and explore period two. The market increases, school gate decreases, and a society sensor outage prevents a comparable trend. The previous action and note remain in the follow-through record.

For live generation, create `.env.local` from `.env.example` without overwriting an existing key:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Both variables are server-only. Set the same names in the correct Vercel environment (API key as Secret, model name as Config), then redeploy. The model must be available to your own project; availability and quota are not guaranteed by listing it.

## Connected workflow

1. Select Ward officer, Housing society or School. Set locality, timezone, language and reading level through Local context.
2. Paste/upload CSV/TSV/TXT. **Review locally** parses the documented headers without a provider call; **Analyze with Gemini** interprets other table structures.
3. Review excluded fields, original source rows, conversions and omitted-line accounting. Correct fields, record the decision and re-include repaired rows. Missing data stays missing.
4. **Confirm reviewed data & generate** computes metrics on the server, then asks Gemini for evidence-conditioned findings, actions and documents. Explicit regeneration is required for changed live context.
5. Inspect action evidence; record status and verification notes. Save/export history to preserve the local record.
6. Compare a new reporting period with the latest compatible earlier live period, or explicitly choose an eligible baseline. Sample history never becomes an automatic live baseline.
7. Open Communication for internal notes and citizen advisories, English/Hindi, Simple/Standard. Copy, download and print use the same complete document text.

Source edits end precomputed sample eligibility. Sample role/reading-level changes are immediate and never spend quota. Live failures preserve the previous successful brief.

## Supported inputs and limits

```csv
site,pollutant,value,unit,timestamp,period,status
School gate,PM2.5,0.086,mg/m3,2026-11-10T08:00+05:30,spot,ok
School gate,PM2.5,94,ug/m3,2026-11-10T09:00+05:30,spot,ok
```

- 100 KB source text, 500 data rows (501 physical lines including headers), 2,000 observations, 1 MB API body, 3 MB imported history, eight stored briefs.
- PM2.5/PM10 mass concentrations only; mg/m³ converts deterministically to µg/m³. Unknown units are unresolved.
- Explicit calendar date and timezone offset, averaging-period label, optional sensor status. Invalid dates, negative/missing values and offline sensors remain excluded. Unusual readings require an explicit reason/approval.
- CSV quotes, table-level delimiters, BOM/line endings, decimal comma in semicolon/TSV files and repeated headers are handled. Multiline quoted records are explicitly unsupported.
- Coverage is currently always reported unknown; confirmed-cadence input and expected-coverage calculation are not implemented. Comparisons require earlier non-overlapping periods, compatible locality/timezone/site/pollutant/averaging label, sample counts and local-time/relative-day slots. This conservative rule can withhold a trend.
- No XLSX/PDF/OCR, live feeds, maps, diagnosis, regulatory bands, automatic sharing or shared team database.

## Architecture and trust boundaries

| Area                            | Responsibility                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`              | Named local UI sections on one page; responsive navigation, evidence dialog, review and communication                  |
| `src/hooks/use-workspace.ts`    | Draft versus saved state, cancellation/revision guards, sample/live separation, local history, bounded artifact reuse  |
| `src/app/api/generate/route.ts` | Streamed body cap, origin validation, operation dispatch, server configuration, Gemini deadline/schema and safe errors |
| `src/lib/air/normalize.ts`      | Source preservation, parsing, calendar/unit/status checks and exclusions                                               |
| `src/lib/air/analyze.ts`        | Metrics, reporting windows, baseline eligibility and conservative comparisons                                          |
| `src/lib/air/validation.ts`     | Bounded runtime contracts, evidence/placeholder and typed direction/ranking checks                                     |
| `src/lib/air/narrative.ts`      | Role-specific sample actions, stable action identities and draft bilingual sample documents                            |
| `src/lib/air/documents.ts`      | Deterministic fact rendering and consistent copy/download/print text                                                   |
| `src/lib/air/history.ts`        | Recomputed imported metrics and legacy-language handling                                                               |

All model/source strings are untrusted data. React renders text, not uploaded HTML. Exact metric IDs are constrained in the model schema and checked again at runtime. Numerical prose uses fact placeholders; values render from server metrics. Typed increase/decrease/highest claims are checked mathematically. This does not prove arbitrary model prose true: users must still review it.

Extraction preserves exact source lines and checks proposed values against numbers in those lines; it is not full semantic proof of every source-cell mapping. Review remains necessary. Source fingerprints are non-cryptographic identifiers, not tamper-proof signatures.

Two intentional model calls per new dataset: interpretation and briefing. No calls on navigation or viewing translations. Same-session validated results may be reused for identical reviewed inputs/context/baseline. Explicit regeneration remains available when inputs change. One attempt, 45-second provider timeout, 60-second route budget, no unlimited retries.

## Local storage and privacy

There is no app login. Selected role tailors remit; it does not establish official authority. History, action states and necessary source excerpts stay in browser localStorage. They are accessible to anyone using the same browser profile; this is not encrypted private team storage. Use export/import to move records. Legacy Marathi snapshots remain labeled read-only; new generation is English/Hindi only.

Gemini interpretation sends table data to Google under its [API terms](https://ai.google.dev/gemini-api/terms). Avoid personal identifiers. General precautions reference [WHO guidance](https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication). Hindi drafts await the user's fluency review.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run benchmark
# Opt-in: two real Gemini calls with fictional sample data
node scripts/smoke.cjs
# Opt-in: one interpretation plus three role briefs (four calls total)
node scripts/smoke.cjs --roles
```

See [verification](docs/verification.md), [performance measurements](docs/performance.md), [AI evaluation](docs/ai-evaluation.md) and [Hindi review](docs/hindi-review.md). CI uses mocked provider tests and production-browser sample journeys; live calls are separate. Native test coverage currently observes transpiled TypeScript and is not a certified source-level coverage result.

## Current status and documentation

Local verification passed: formatting, lint, TypeScript/production build, **28 domain/API tests and six Chromium browser regressions**. Live extraction and each role's brief succeeded across runs; the all-role run also encountered transient provider failures. A passing individual call is not a provider-availability guarantee.

- [Current backlog](TODO.md): implemented features and remaining work, including deeper cell mapping, cadence controls and acceptance gaps.
- [Product direction](PRODUCT_PLAN.md): Bhopal scenario, USP, visual contract and access decision.
- [Evaluation contract](EVALUATION_PLAN.md): weighted categories and all 21 criteria; the revised app has not been independently scored.

Browser prerequisites: run `npm run build` before `npm run test:e2e`. Playwright uses a production server at `127.0.0.1:3119`; the six tests run local workflows and do not call Gemini. CI is configured, but a successful local run is not evidence of a completed GitHub Actions run.

`npm run benchmark` prints measurements. `node scripts/benchmark.cjs --write` also replaces the recorded performance report. `npm run test:coverage` is available, with the transpilation limitation noted above.

## Release limitations

A browser cooldown and origin check are not distributed abuse protection. Configure and verify supported Vercel firewall/rate limits before publicly sharing live generation. Confirm the plan's function duration and environment scope, then smoke-test the deployed endpoint. This iteration does not create or modify a Vercel deployment or GitHub remote.

The current implementation provides the main planned workflow; fluency acceptance, exhaustive accessibility/contrast audits, model-candidate comparison and an independent refreshed evaluator score remain open. No 98+ score has been awarded.

## Evidence dashboard

Load Sample Data, then explore one pollutant/averaging group, selected sites and observed timestamps. Charts share deterministic reviewed-observation calculations, with source links and textual values. Secondary views disclose matched changes, a timezone day matrix and excluded/unresolved records. Partial time selections suppress deltas; filtering makes no Gemini calls. Owner/status/evidence filters affect only the action queue.

Inspection priority uses visible 60/20/20 rank/context/remit weights. No total appears until sensitivity, remit and a written rationale are confirmed; one site has no relative score. This is an inspection heuristic, not a medical or official AQI score. Context fields are temporary exploration notes; **Export exploration** retains the selected scope and confirmations. Save brief and communication documents retain the original brief scope. New dashboard controls are currently English; existing English/Hindi documents remain available.
