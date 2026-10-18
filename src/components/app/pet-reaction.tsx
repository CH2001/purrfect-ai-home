import { useEffect, useState } from "react";
import type { Trial } from "@/lib/domain/types";
import { trialReaction } from "@/lib/ai/ai.functions";
import { cloudEnabled } from "@/lib/cloud/client";
import { scriptedReaction } from "@/lib/sim/reaction";

export function PetReaction({ trial }: { trial: Trial }) {
  const [result, setResult] = useState(() => scriptedReaction(trial));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setResult(scriptedReaction(trial));
    if (!cloudEnabled) return;
    setBusy(true);
    const timer = setTimeout(() => {
      void trialReaction({ data: { trialId: trial.trialId } })
        .then(next => { if (alive) setResult(next); })
        .catch(() => { /* Rules-based reaction stays visible on model/quota failure. */ })
        .finally(() => { if (alive) setBusy(false); });
    }, 1000);
    return () => { alive = false; clearTimeout(timer); };
  }, [trial.trialId, trial.stateVersion]);
  return <section className="card-soft mt-3 p-3" aria-label="Pet reaction" aria-live="polite">
    <p className="font-display font-semibold">{trial.snapshot.animal.name}'s reaction</p>
    <p className="mt-1 text-sm">{result.reaction}</p><p className="mt-2 text-xs">{result.suggestion}</p>
    <p className="mt-2 text-[10px] text-muted-foreground">{busy ? "Mimi is imagining a reaction…" : result.source === "gemini" ? "AI-generated reaction · based on personality and your care" : "Scripted reaction · AI unavailable or offline"} · simulated, not a real behavioural prediction.</p>
  </section>;
}
