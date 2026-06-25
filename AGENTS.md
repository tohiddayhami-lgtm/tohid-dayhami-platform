# AGENTS.md

## Cursor Cloud specific instructions

This is a single-page **Vite + React 19 + TypeScript** app (a Persian/RTL export & trade CRM/"metaverse" platform). There is no backend in this repo — it talks directly to **Firebase** (Firestore/Storage) using config hardcoded in `services/firebaseService.ts`, and to the **Gemini API** via `services/geminiService.ts`. The `api/` directory holds Vercel serverless functions (OG meta, cron summaries) that are only exercised in Vercel deployments, not in local `npm run dev`.

### Run / build / test
- Dev server: `npm run dev` (Vite, serves on `0.0.0.0:3000`). Standard command from `README.md`/`package.json`.
- Production build: `npm run build` (outputs to `dist/`).
- There is **no lint script and no test suite** in `package.json` (only `dev`, `build`, `preview`, `crawl:index`). Do not expect `npm test`/`npm run lint` to exist.

### Non-obvious caveats
- `npm run build` prints an esbuild warning `Duplicate key "z"` in `components/ExpoEditor.tsx`. This is **non-fatal** — the build still completes successfully. Don't treat it as a build failure.
- `GEMINI_API_KEY` is read at build/dev time via `vite.config.ts` and injected as `process.env.API_KEY` / `process.env.GEMINI_API_KEY`. It is optional for the app to load/render; only the AI features (ticket analysis, generation, etc.) need it. Put it in `.env.local` if you need those features.
- Firebase credentials are committed/hardcoded and point at a **real production** project (`company-crm-103aa`). The app reads/writes live Firestore data, so avoid creating/submitting real records (tickets, orders, etc.) during testing unless intentional.
