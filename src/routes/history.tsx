import { ANIMAL_IMAGES } from "@/lib/data/images";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ChevronRight, Clock, FileText, Heart } from "lucide-react";
import { AppShell, Chip, PageHeader, Pips, SectionTitle, btn } from "@/components/app/shell";
import { ANIMALS } from "@/lib/data/seed";
import { useAppState } from "@/lib/repo/store";
import { cn } from "@/lib/utils";
import { useFeatureTransition } from "@/components/app/feature-transition";
import { SampleAdoptionHistory } from "@/components/app/sample-adoption-history";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Adoption history — Purrfect Home" },
      { name: "description", content: "Your saved pets, readiness reports and past virtual adoption trials." },
      { property: "og:title", content: "Adoption history — Purrfect Home" },
      { property: "og:description", content: "Saved pets, readiness reports and past trials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: History,
});

const PAGE = 10; // GCP: Firestore query trials where ownerUid==uid orderBy createdAt desc limit(PAGE) + startAfter cursor

function History() {
  const { run } = useFeatureTransition();
  const [tab, setTab] = useState<"COMPLETED" | "IN_PROGRESS">("COMPLETED");
  const [limit, setLimit] = useState(PAGE);
  const trials = useAppState((s) => s.trials);
  const favorites = useAppState((s) => s.favorites);
  const list = trials.filter((t) => t.status === tab);
  const latest = tab === "COMPLETED" ? list[0] : undefined;
  const rest = (latest ? list.slice(1) : list).slice(0, limit);

  return (
    <AppShell>
      <PageHeader title="Adoption History" subtitle="Your saved reports and past trials" />
      <div className="grid grid-cols-2 rounded-full bg-card p-1 shadow-soft">
        {(["COMPLETED", "IN_PROGRESS"] as const).map((k) => (
          <button key={k} onClick={() => { if (tab !== k) run(() => setTab(k)); }} className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {k === "COMPLETED" ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}{k === "COMPLETED" ? "Completed" : "In Progress"}
          </button>
        ))}
      </div>

      {latest?.report && (
        <section className="card-soft mt-4 p-3">
          <div className="flex justify-between"><Chip tone="success"><CheckCircle2 className="size-3.5" />7-day trial completed</Chip><span className="text-xs text-muted-foreground">{new Date(latest.completedAt!).toLocaleDateString()}</span></div>
          <div className="mt-3 flex gap-3">
            <img src={ANIMAL_IMAGES[latest.animalId]} alt="" className="size-32 rounded-2xl object-cover" />
            <div className="flex-1">
              <p className="font-display text-2xl font-semibold">{latest.snapshot.animal.name}</p>
              <p className="text-xs text-muted-foreground">{latest.snapshot.animal.species === "CAT" ? "Cat" : "Dog"} · {latest.snapshot.animal.sex.toLowerCase()}</p>
              <div className="mt-2 rounded-xl bg-warning-soft p-2"><p className="text-[11px] font-bold text-warning">Overall assessment</p><p className="font-display font-semibold leading-tight">{latest.report.headline}</p></div>
            </div>
          </div>
          <Link to="/report/$trialId" params={{ trialId: latest.trialId }} className={btn.primary + " mt-3 w-full"}><FileText className="size-4" />View Report</Link>
          <SectionTitle title="Report preview" />
          <div className="grid grid-cols-2 gap-2">
            {latest.report.dimensions.map((d) => (
              <div key={d.key} className="rounded-xl bg-muted p-2 text-xs"><p className="font-bold">{d.label}</p><p className="text-muted-foreground">{d.status.replace("_", " ").toLowerCase()}</p><div className="mt-1"><Pips value={d.score} /></div></div>
            ))}
          </div>
        </section>
      )}

      <SectionTitle title={tab === "COMPLETED" ? "Past adoption trials" : "Trials in progress"} />
      {list.length === 0 && <p className="card-soft p-4 text-sm text-muted-foreground">Nothing here yet. <Link to="/discover" className="font-bold text-accent">Start a trial</Link></p>}
      <ul className="space-y-2">
        {rest.map((t) => (
          <li key={t.trialId}>
            <Link to={t.status === "COMPLETED" ? "/report/$trialId" : "/trials/$trialId"} params={{ trialId: t.trialId }} className="card-soft flex items-center gap-3 p-2.5">
              <img src={ANIMAL_IMAGES[t.animalId]} alt="" className="size-16 rounded-xl object-cover" />
              <div className="flex-1 text-sm"><p className="font-display font-semibold">{t.snapshot.animal.name}</p><p className="text-xs text-muted-foreground">{t.status === "COMPLETED" ? t.report?.headline : `Day ${t.day} of 7`} · profile {t.snapshot.household.versionId}</p></div>
              <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
              <ChevronRight className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      {list.length > limit + 1 && <button className={btn.ghost + " mt-3 w-full"} onClick={() => setLimit((l) => l + PAGE)}>Load more</button>}

      {tab === "COMPLETED" && <SampleAdoptionHistory />}

      <SectionTitle title="Saved pets" />
      <div className="flex flex-wrap gap-2">
        {favorites.length === 0 && <p className="text-sm text-muted-foreground">Tap the heart on any pet to save them.</p>}
        {favorites.map((id) => { const a = ANIMALS.find((x) => x.animalId === id)!; return (
          <Link key={id} to="/animals/$animalId" params={{ animalId: id }} className="card-soft flex items-center gap-2 p-1.5 pr-3 text-sm font-semibold"><img src={ANIMAL_IMAGES[id]} alt="" className="size-8 rounded-full object-cover" />{a.name}<Heart className="size-3.5 fill-accent text-accent" /></Link>
        ); })}
      </div>
    </AppShell>
  );
}
