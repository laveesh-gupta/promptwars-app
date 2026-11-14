# AI evaluation

The configured model is server-only; this iteration does not silently change it or fail over to a different model. The provider receives metrics, quality issues, earlier reporting-period context and prior actions. Uploaded content is untrusted data, not instructions.

Quantitative prose uses approved placeholders rendered by application code. Direction/rank assertion fields are checked against server metrics; free prose is still subject to human review. This does not prove arbitrary narrative truth.

The optional `node scripts/smoke.cjs` makes two real calls with fictional data, checking extraction then brief validation. Domain/API tests mock Gemini and include unknown evidence and contradictory direction cases. Candidate-model benchmarking and fluent Hindi acceptance remain distinct work, with no fabricated scores or latency claims.

## Live result

The updated evidence-enum schema plus runtime validation passed a real fictional-data extraction and briefing run. Early provider responses were correctly rejected for unknown references and unconstrained numerical text; the contract was tightened without removing measurement/evidence checks. Scheduling horizons are distinguished from measured pollution claims. The all-role smoke option (`node scripts/smoke.cjs --roles`) reuses one interpretation for three role briefs. See the final run result below.

### Recorded role outcomes

Real structured brief validation succeeded for Ward officer, Housing society and School across the verification runs, each with Hindi internal text. The final matrix produced valid Ward/Society briefs and a School upstream failure; School had succeeded in the preceding matrix. Intermittent provider failures and initial invalid output were observed and are not hidden. They preserve the workspace and require explicit retry. This is not a claim that every future provider request will succeed or a completed candidate-model benchmark.

Verified metric-ID citations and equivalent unit typography are accepted as references/units, rather than misclassified as invented numbers. Unreferenced numerical measurements, unknown evidence IDs and contradictory typed assertions remain rejected. Numeric action horizons are restricted to simple durations.

## Reproduce without overstating the result

```bash
# Requires .env.local; two provider calls, one role
node scripts/smoke.cjs
# Four provider calls: one interpretation, three role briefs
node scripts/smoke.cjs --roles
```

These commands invoke the real route handler in process, not a deployed HTTP endpoint. They use only the built-in fictional table and never print credentials. A nonzero exit means at least one requested operation failed; do not report the matrix as entirely green because other roles succeeded. The recorded final matrix had two valid role briefs and one upstream failure. School passed in an earlier run; a single all-role clean run was not recorded.

The model name comes from server configuration; per-run model/prompt/schema metadata is not a complete benchmark log. No candidate-model ranking, Hindi fluency score, semantic-accuracy percentage or provider p95 latency has been established.
