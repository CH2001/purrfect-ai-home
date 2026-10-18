# Verification of the GCP integration

## Demo update — 18 October 2026

- TypeScript check and production Vite/Nitro build passed.
- 10 Vitest suites / 35 tests passed, including stable allocating React selectors, automatic guest entry, preservation of existing sessions, failed-session handling, catalogue retrieval and feeding-dependent hunger.
- A headless Edge browser verified Simulate navigation, starting a trial, actionable attention cards, care interaction, reaction display, chat replies and catalogue source links. Both MP3 files decoded successfully in the browser (about 0.79s and 2.61s).
- The production output includes the local cat MP3, dog MP3 and loading GIF.
- The compiled server passed Firebase emulator tests with two anonymous guest sessions plus an existing email/password session: authentication, account isolation, idempotency, concurrency, immutable snapshots, seven-day reports, reminder deduplication and deletion.
- Terraform provider-schema validation passed. No Terraform apply or Cloud Build submission was performed for this update.
- Live Gemini generation and the updated deployment still require verification in your GCP project. Browser chat testing used the labelled catalogue fallback; model output was not represented as tested.

Follow `REDEPLOY_DEMO.md` to build and apply the update. The app uses small-catalogue lexical retrieval rather than a managed vector database. AI reactions are narrative; the deterministic simulation controls state and scores.

## Original integration — 17 October 2026

Verified locally on 17 October 2026 using Node 24.19.0 and Java 21:

- TypeScript `tsc --noEmit`: passed.
- Vitest: 7 suites, 26 tests passed.
- Vite/Nitro production build: passed. Firebase Admin, Firestore and Google authentication dependencies are traced into the server output, preserving their runtime assets.
- Firebase Auth/Firestore emulator smoke test against the compiled Node server: passed. Covers unauthenticated rejection, isolation between two accounts, idempotent commands, stale revisions, rejected forged state, immutable household snapshots, a seven-day trial and persisted report, reminder deduplication, private-route separation and application-data deletion.
- Terraform formatting and provider-schema validation: passed with Google providers 7.46.1.
- Git diff whitespace check: passed.

No real GCP deployment, Terraform plan/apply, billable Vertex request, Cloud Build execution, or production IAM test was performed. Linux container execution and complete browser/mobile acceptance remain deployment checks. Emulator tests do not establish actual IAM or Firestore production index readiness. Follow the deployment verification section in `GCP_SETUP.md`.

The source ZIP excludes installed dependencies, build outputs, local environment files, Terraform state/plans/provider cache, test logs and Git internals. Run `npm ci` after extracting it. The editable downloaded Git checkout is provided separately alongside the ZIP.
