import { ANIMAL_IMAGES } from "@/lib/data/images";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, CheckCircle2, Info, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Chip, PageHeader, Pips, ProvBadge, SectionTitle, btn } from "@/components/app/shell";

import { startTrial, useAppState } from "@/lib/repo/store";



export const Route = createFileRoute("/report/$trialId")({
  head: () => ({
    meta: [
      { title: "Readiness report — Purrfect Home" },
      { name: "description", content: "Your qualified readiness report from a simulated seven-day home trial." },
      { property: "og:title", content: "Readiness report — Purrfect Home" },
      { property: "og:description", content: "A qualified readiness report from a simulated home trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const STATUS = { PREPARED: ["Prepared", "success"], NEEDS_ACTION: ["Needs attention", "warning"], GRADUAL_PLAN: ["Gradual plan", "info"], UNKNOWN: ["Unknown", "lilac"] } as const;

function ReportPage() {
  const { trialId } = Route.useParams();
  const trial = useAppState((s) => s.trials.find((t) => t.trialId === trialId));
  const activeVersion = useAppState((s) => s.activeVersionId);
  const nav = useNavigate();


  if (!trial) return <AppShell><p className="p-8 text-center text-muted-foreground">Loading report…</p></AppShell>;
  if (!trial.report) return <AppShell><p className="p-8 text-center text-muted-foreground">{trial.status === "COMPLETED" ? "Writing your report…" : "This trial isn't finished yet."}</p></AppShell>;
  const r = trial.report;
  const a = trial.snapshot.animal;
  const stale = trial.snapshot.household.versionId !== activeVersion;

  const rerun = async () => {
    try { const trialId = await startTrial(a.animalId, trial.trialId); nav({ to: "/trials/$trialId", params: { trialId } }); }
    catch (error) { toast.error((error as Error).message); }
  };

  return (
    <AppShell>
      <PageHeader title="Readiness report" subtitle={`${a.name} · completed ${new Date(trial.completedAt!).toLocaleDateString()}`} />
      <section className="card-soft overflow-hidden">
        <div className="flex gap-3 p-3">
          <img src={ANIMAL_IMAGES[a.animalId]} alt="" className="size-28 rounded-2xl object-cover" />
          <div className="flex-1">
            <Chip tone="success"><CheckCircle2 className="size-3.5" /> 7-day trial completed</Chip>
            <div className="mt-2 rounded-xl bg-warning-soft p-2"><p className="flex items-center gap-1 text-[11px] font-bold text-warning"><BarChart3 className="size-3.5" />Overall assessment</p><p className="font-display font-semibold leading-tight">{r.headline}</p></div>
          </div>
        </div>
        <p className="px-3 pb-3 text-sm">{r.narrative}</p>
        <p className="flex items-start gap-1.5 border-t border-border bg-muted p-3 text-[11px] text-muted-foreground"><Info className="size-3.5 shrink-0" />Simulation for educational purposes only. Not a prediction of behaviour or a certification of suitability. The rescuer makes the final decision.</p>
      </section>

      <SectionTitle title="Readiness areas" />
      <div className="grid grid-cols-2 gap-2">
        {r.dimensions.map((d) => {
          const [l, tone] = STATUS[d.status];
          return (
            <div key={d.key} className="card-soft p-3">
              <p className="font-display font-semibold">{d.label}</p>
              <p className={{ success: "text-success", warning: "text-warning", info: "text-info", lilac: "text-lilac" }[tone] + " text-xs font-bold"}>{l}</p>
              <div className="mt-2"><Pips value={d.score} tone={tone === "lilac" ? "info" : tone} /></div>
              <p className="mt-1 text-[10px] text-muted-foreground">{d.evidence.length} evidence events</p>
            </div>
          );
        })}
      </div>

      {r.strengths.length > 0 && <><SectionTitle title="Household strengths" />
        <ul className="space-y-2">{r.strengths.map((s) => <li key={s.text} className="card-soft flex items-center justify-between gap-2 p-3 text-sm">{s.text}<ProvBadge p="SIMULATED" /></li>)}</ul></>}

      {r.risks.length > 0 && <><SectionTitle title="Care risks" />
        <ul className="space-y-2">{r.risks.map((x) => <li key={x.text} className="card-soft p-3 text-sm"><div className="flex justify-between gap-2"><b>{x.text}</b><Chip tone={x.severity === "HIGH" ? "danger" : x.severity === "MEDIUM" ? "warning" : "muted"}>{x.severity}</Chip></div><p className="mt-1 text-muted-foreground">→ {x.mitigation}</p></li>)}</ul></>}

      <SectionTitle title="Uncertainties" />
      <ul className="card-soft space-y-1.5 p-3 text-sm">{r.uncertainties.map((u) => <li key={u} className="flex gap-2"><ProvBadge p="UNKNOWN" /><span>{u}</span></li>)}</ul>

      <SectionTitle title="Next steps with the rescuer" />
      <ol className="card-soft list-decimal space-y-1 p-3 pl-8 text-sm">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ol>

      <SectionTitle title="Seven-day timeline" />
      <ol className="space-y-1.5">
        {trial.events.filter((e) => e.kind !== "DAY_COMPLETE").map((e) => (
          <li key={e.eventId} className="flex items-center gap-2 text-xs"><span className="w-12 font-bold">Day {e.day}</span><span className="flex-1">{e.code.replace(/_/g, " ").toLowerCase()}</span><span className="text-muted-foreground">{e.kind.replace("_", " ").toLowerCase()}</span></li>
        ))}
      </ol>

      <p className="mt-4 text-[10px] text-muted-foreground">Model {r.provenance.modelId} · prompt {r.provenance.promptVersion} · rules {r.provenance.rulesVersion} · seed {r.provenance.seed} · profile {trial.snapshot.household.versionId}</p>

      <div className="mt-5 grid gap-2">
        <button className={btn.primary} onClick={rerun}><RotateCcw className="size-4" />{stale ? "Start new trial with updated profile" : "Try a different routine"}</button>
        {stale && <p className="text-center text-xs text-muted-foreground">Your household profile changed since this trial. This report keeps its original snapshot.</p>}
        <button className={btn.ghost} onClick={() => toast("Sharing with rescuers requires your explicit consent and a signed-in account — coming with shelter onboarding.")}><Send className="size-4" />Send to rescuer</button>
        <Link to="/history" className="text-center text-sm font-bold text-accent">Back to history</Link>
      </div>
    </AppShell>
  );
}
