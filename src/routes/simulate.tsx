import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell, Logo, Pips, SectionTitle, btn } from "@/components/app/shell";
import { ANIMAL_IMAGES } from "@/lib/data/seed";
import { useAppState } from "@/lib/repo/store";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Your virtual trials — Purrfect Home" },
      { name: "description", content: "Resume an in-progress seven-day home trial or start a new one." },
      { property: "og:title", content: "Your virtual trials — Purrfect Home" },
      { property: "og:description", content: "Resume or start a seven-day home trial." },
    ],
  }),
  component: Simulate,
});

function Simulate() {
  const trials = useAppState((s) => s.trials.filter((t) => t.status === "IN_PROGRESS"));
  return (
    <AppShell>
      <Logo small />
      <h1 className="mt-4 text-3xl font-semibold">Simulate</h1>
      <p className="text-sm text-muted-foreground">Seven accelerated days of care, routines and gentle introductions.</p>
      <SectionTitle title="In progress" />
      {trials.length === 0 && <p className="card-soft p-4 text-sm text-muted-foreground">No active trials yet.</p>}
      <div className="space-y-3">
        {trials.map((t) => (
          <Link key={t.trialId} to="/trials/$trialId" params={{ trialId: t.trialId }} className="card-soft flex items-center gap-3 p-3">
            <img src={ANIMAL_IMAGES[t.animalId]} alt="" className="size-16 rounded-xl object-cover" />
            <div className="flex-1"><p className="font-display text-lg font-semibold">{t.snapshot.animal.name}</p><p className="text-xs text-muted-foreground">Day {t.day} of 7 · profile {t.snapshot.household.versionId}</p><div className="mt-1.5"><Pips value={t.day - 1} total={7} /></div></div>
            <ArrowRight className="size-5" />
          </Link>
        ))}
      </div>
      <Link to="/discover" className={btn.primary + " mt-6 w-full"}>Start a new trial</Link>
    </AppShell>
  );
}
