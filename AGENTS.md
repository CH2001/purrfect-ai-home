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
- Discover recommendations are a pure presentation-only criteria helper; ordering is not a compatibility probability and missing shelter facts stay unknown, so recommendations never approve adoption or alter trial authority.
- Adoption-provider display information is keyed by animal shelterId in the seed directory; keep it presentation-only so mock contacts never change trial authority.
- Domain contracts live in `src/lib/domain/types.ts` and mirror the spec JSON schemas — keep them in sync with the future Cloud Run Pydantic models.
- Persistence goes only through `src/lib/repo/store.ts` (currently localStorage mock); swap it for Firebase Auth + Cloud Run `/api/v1` + Firestore without touching routes.
- AI calls go only through server functions in `src/lib/ai/ai.functions.ts` (currently mock LLM); Gemini/Vertex wiring is documented there in comments. LLM output never mutates authoritative state.
- Simulation is a pure deterministic engine (`src/lib/sim/engine.ts`, xorshift32 seed via `src/lib/sim/prng.ts`) so trials replay identically; the production authority is the Cloud Run service, the client copy is preview only.
- The day & night life log (`src/lib/sim/daylife.ts`) is a deterministic presentation layer driven by the day's actual care actions; behaviour changes stay gradual (≥90 simulated minutes) and loneliness derives from the animal's sociability profile, never assumed for UNKNOWN traits.
- Trials pin an immutable household/animal snapshot; household edits always create a new version, never rewrite old reports.
- Feature loading delays live in one root presentation provider; navigation and in-page feature switches share it without changing repository or simulation authority.
- Pet audio lives in a root session-only provider and a pure species/age/breed-size profile helper; playback requires a user gesture and never alters authoritative simulation state.
