<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Domain contracts live in `src/lib/domain/types.ts` and mirror the spec JSON schemas — keep them in sync with the future Cloud Run Pydantic models.
- Persistence goes only through `src/lib/repo/store.ts` (currently localStorage mock); swap it for Firebase Auth + Cloud Run `/api/v1` + Firestore without touching routes.
- AI calls go only through server functions in `src/lib/ai/ai.functions.ts` (currently mock LLM); Gemini/Vertex wiring is documented there in comments. LLM output never mutates authoritative state.
- Simulation is a pure deterministic engine (`src/lib/sim/engine.ts`, xorshift32 seed) so trials replay identically; the production authority is the Cloud Run service, the client copy is preview only.
- Trials pin an immutable household/animal snapshot; household edits always create a new version, never rewrite old reports.
- Feature loading delays live in one root presentation provider; navigation and in-page feature switches share it without changing repository or simulation authority.
