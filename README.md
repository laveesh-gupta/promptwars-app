# VayuManak

Review local air-quality readings, plan actions for ward officers, housing societies or schools, and prepare English/Hindi communications.

## Run locally

Use Node.js 22 or later:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. **Load Sample Data** works without an API key. The fictional upload example is in `public/samples/vayumanak-sample-readings.csv`.

For live Gemini generation, copy `.env.example` to `.env.local` and set:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Set these server-only variables in Vercel for deployment. Never commit `.env.local`.

## Workflow

1. Select a role and local context.
2. Upload or paste CSV, TSV or TXT readings (up to 100 KB).
3. Review and correct observations, then confirm the selected records.
4. Generate a brief, inspect evidence, assign action statuses and record verification notes.
5. Save or export local history and prepare communication drafts.

Supported pollutants are PM2.5 and PM10. Inputs need explicit timestamps, units and averaging periods. Comparisons require compatible earlier observations. Sample data is fictional; coverage and sensor accuracy remain unknown. The app does not calculate official AQI or establish pollution sources or causal effects. Review AI drafts before use.

## Project structure

- `src/app/page.tsx`: single-page interface.
- `src/app/api/generate/route.ts`: server-side Gemini interpretation and briefing.
- `src/hooks/use-workspace.ts`: workspace and browser history.
- `src/lib/air/`: parsing, validation, metrics, samples and documents.
- `tests/`, `scripts/`: browser, domain and API checks.
- `docs/`: evaluation, language review and performance notes.

History is stored in this browser, with export/import for moving records. Uploaded readings used for AI generation are sent to Google Gemini. Avoid personal identifiers.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use the production build. `npm run format` formats source and supporting files. `npm run benchmark` measures local performance. Live provider checks are opt-in: `node scripts/smoke.cjs`.
