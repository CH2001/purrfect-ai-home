# GCP implementation notes

## Reference requirements and implementation choices

The three supplied v1.2 Word specifications were used as reference material. Their embedded deployment examples and instructions were not executed. The user's request authorized downloading and modifying the code and creating Terraform/setup documentation, not creating billable cloud resources or changing the upstream repository.

This copy starts from the downloaded Git history; see `git log -1` for the base commit. There are no pushed commits from this work.

| Requirement | Implementation |
| --- | --- |
| Firebase sessions | Automatic anonymous guest entry without login UI; verified per-browser UID; existing authenticated sessions remain usable |
| Persistence seam | `src/lib/repo/store.ts` retains selectors; explicit asynchronous commands replace local authoritative writes |
| User isolation | Firebase Admin verifies bearer ID tokens and revocation; UID is never accepted from request data |
| Household snapshots | Validated patches create new version records; old trial snapshots remain pinned |
| Trial authority | `commands.ts` invokes the same TypeScript engine server-side; client scores/reports are rejected |
| Concurrency and retries | Global per-user revision plus trial revision/day validation; transactional request receipts |
| Event history | Append-only trial event documents; aggregate state reconstructed for existing UI |
| Gemini | Server functions, ADC-authenticated Vertex REST calls, bounded inputs and Zod output validation, scripted fallback |
| Pet chat | Lexical retrieval of synthetic catalogue records, saved household criteria, bounded conversation history, source links; Gemini explains retrieved data |
| Pet reactions | Gemini narration from the server-owned snapshot, state and care events; model output never changes authoritative simulation values |
| Reports | Server builds facts and scores; optional Vertex narration changes only narrative and model attribution |
| Reminders | Private worker, Cloud Scheduler OIDC, due index, transactionally deduplicated generic in-app notice |
| Secrets | Keyless Google identities; optional Secret Manager references; no secret values in Terraform |
| Deployment | Node container, Cloud Build configuration, Terraform provider lock, setup guide |

## Storage mapping

```text
users/{verifiedUid}
  preferences, review settings/log, activeVersionId, revision
  /householdVersions/{versionId}     immutable
  /trials/{trialId}                  pinned snapshots plus current state/day/report
    /events/{sequence}               append-only
    /reportNarration/v1              sanitized one-attempt narration audit
  /requests/{uuid}                   idempotency receipts
  /notifications/{dueCycleHash}      deduplicated in-app notices
  /aiUsage/{UTC-date}                daily quota; TTL cleanup
reviewDueIndex/{uid}                 review timing/preferences only
```

Direct Firestore browser access is denied. Admin SDK bypasses rules, so the backend's verified-UID ownership boundary and service IAM are essential. The private worker has database access but no Vertex role. Build identity has no database access.

Request receipts persist with user data, ensuring old action retries cannot silently repeat. “Delete my data” marks the user as deleting, removes the due index and subcollections, then removes the root. Repeating deletion safely resumes a partially failed operation. Firebase Auth account removal and PITR retention are separate processes.

## Interfaces

- `GET /health`: liveness, no personal data.
- `GET /api/v1/state`: signed-in user's state and revision.
- `POST /api/v1/commands`: `{requestId, expectedRevision, command}` with strict discriminated schemas. Commands: preferences, household, createTrial, care, day.
- `DELETE /api/v1/data`: signed-in user's application data.
- `/internal/reminders`: POST on worker only; Cloud Run IAM authenticates invokers.
- TanStack server functions: household extraction, change proposals, display-only narration and companion chat. All cloud-mode calls require the user's Firebase bearer token.

The API does not trust client-supplied animal snapshots, simulation values, owner IDs, reports or version metadata. Confirmed household fields are user-reported; AI output remains a draft until the user confirms. Synthetic animal/provider data remain clearly labelled.

## Deliberate limits

The supplied documents describe future Python/FastAPI, Firebase Hosting, canonical top-level collections, FCM and more extensive pagination. This implementation reuses the existing TypeScript engine in one Cloud Run web/API image; a second private service runs the reminder endpoint. This avoids simulation drift and separate-origin authentication. No Firebase Hosting deployment is needed.

The full-history repository adapter is suitable for initial small accounts, not an unlimited event archive. A subsequent scale-focused change should introduce paginated trial projections and targeted transaction reads. Browser preference edits are optimistic; authoritative trial/profile commands await server confirmation. Conflicts refresh server state and require the user to review/retry. Cloud data are not cached in the demo localStorage key.

FCM delivery, real shelter moderation, sharing, clinical validation of rules and full mobile acceptance testing remain separate work. See `GCP_SETUP.md` for actual deployment verification and launch checks.
