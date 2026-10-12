import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart, X, Home, ShieldCheck, Cat, Dog, PawPrint, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Chip, Logo, btn } from "@/components/app/shell";
import { ANIMALS, ANIMAL_IMAGES } from "@/lib/data/seed";
import { activeHousehold, getState, setState, toggleFavorite, upsertTrial, useAppState } from "@/lib/repo/store";
import { createTrial } from "@/lib/sim/engine";
import { cn } from "@/lib/utils";
import { useFeatureTransition } from "@/components/app/feature-transition";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover rescue pets — Purrfect Home" },
      { name: "description", content: "Swipe through approved rescue cats and dogs and save your favourites." },
      { property: "og:title", content: "Discover rescue pets — Purrfect Home" },
      { property: "og:description", content: "Swipe through approved rescue cats and dogs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

export function startTrialFor(animalId: string) {
  const a = ANIMALS.find((x) => x.animalId === animalId)!;
  if (a.status !== "APPROVED") { toast.error(`${a.name} is no longer available for trials.`); return null; }
  const s = getState();
  const existing = s.trials.find((t) => t.animalId === animalId && t.status === "IN_PROGRESS");
  if (existing) return existing.trialId;
  const t = createTrial(a, activeHousehold(s));
  upsertTrial(t);
  return t.trialId;
}

function Discover() {
  const { run } = useFeatureTransition();
  const [filter, setFilter] = useState<"CAT" | "DOG" | "ALL">("CAT");
  const [idx, setIdx] = useState(0);
  const favorites = useAppState((s) => s.favorites);
  const hh = useAppState(activeHousehold);
  const nav = useNavigate();
  const list = useMemo(() => ANIMALS.filter((a) => a.status === "APPROVED" && (filter === "ALL" || a.species === filter)), [filter]);
  const a = list[idx % list.length];
  const prev = list[(idx - 1 + list.length) % list.length];
  const next = list[(idx + 1) % list.length];

  const pass = () => { setState((s) => ({ ...s, passed: [...new Set([...s.passed, a.animalId])] })); setIdx((i) => i + 1); };
  const save = () => { if (!favorites.includes(a.animalId)) toggleFavorite(a.animalId); toast.success(`${a.name} saved to your shortlist`); setIdx((i) => i + 1); };
  const start = () => { const id = startTrialFor(a.animalId); if (id) nav({ to: "/trials/$trialId", params: { trialId: id } }); };

  return (
    <AppShell>
      <div className="flex items-center justify-between"><Logo small /><Link to="/history" aria-label="Saved" className="grid size-10 place-items-center rounded-full bg-card shadow-soft"><Heart className="size-5 fill-accent text-accent" /></Link></div>
      <h1 className="mt-3 text-center text-3xl font-semibold">Discover</h1>
      <p className="text-center text-sm text-muted-foreground">Find your purrfect companion</p>

      <div className="mt-4 grid grid-cols-3 rounded-full bg-card p-1 shadow-soft" role="tablist">
        {([["CAT", "Cats", Cat], ["DOG", "Dogs", Dog], ["ALL", "Mixed", PawPrint]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => { if (filter !== k) run(() => { setFilter(k); setIdx(0); }); }}
            className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <I className="size-4" />{l}
          </button>
        ))}
      </div>

      <div className="relative mt-5 h-[440px]">
        {list.length > 1 && [prev, next].map((p, i) => (
          <div key={p.animalId + i} className={cn("card-soft absolute top-6 h-[380px] w-[70%] overflow-hidden opacity-70", i === 0 ? "-left-10 -rotate-3" : "-right-10 rotate-3")}>
            <img src={ANIMAL_IMAGES[p.animalId]} alt="" className="h-2/3 w-full object-cover" />
          </div>
        ))}
        <Link key={a.animalId} to="/animals/$animalId" params={{ animalId: a.animalId }} className="card-soft animate-pop absolute inset-x-6 top-0 z-10 overflow-hidden">
          <div className="relative">
            <img src={ANIMAL_IMAGES[a.animalId]} alt={a.name} className="aspect-[4/3.4] w-full object-cover" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-xs font-bold text-success"><ShieldCheck className="size-3.5" /> Shelter listing · Demo</span>
            <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-card"><Heart className={cn("size-5 text-accent", favorites.includes(a.animalId) && "fill-accent")} /></span>
          </div>
          <div className="p-4">
            <p><span className="font-display text-2xl font-semibold">{a.name}</span> <span className="ml-2 text-sm text-muted-foreground">{a.ageMonths < 12 ? `${a.ageMonths} months old` : `${Math.round(a.ageMonths / 12)} years old`}</span></p>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{a.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{a.tags.map((t, i) => <Chip key={t} tone={(["warning", "success", "danger"] as const)[i % 3]}>{t}</Chip>)}</div>
          </div>
        </Link>
      </div>

      <div className="card-soft mt-2 p-3">
        <p className="flex items-center gap-2 font-display font-semibold"><Sparkles className="size-4 text-warning" /> Matched to your household</p>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Home className="size-4" /> {hh.noiseLevel === "LOW" ? "Quiet" : "Moderate"} {hh.homeType?.toLowerCase()}</span>
          {hh.pets[0] && <span className="flex items-center gap-1"><PawPrint className="size-4" /> Existing {hh.pets[0].species.toLowerCase()}</span>}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Saving a pet never implies adoption approval.</p>
      </div>

      <div className="mt-5 flex items-end justify-around">
        <button onClick={pass} className="flex flex-col items-center gap-1 text-sm font-semibold"><span className="grid size-16 place-items-center rounded-full bg-card shadow-soft"><X className="size-8 text-accent" /></span>Pass</button>
        <button onClick={save} className="flex flex-col items-center gap-1 text-sm font-semibold"><span className="grid size-16 place-items-center rounded-full bg-card shadow-soft"><Heart className="size-8 fill-accent text-accent" /></span>Save</button>
        <button onClick={start} className="flex flex-col items-center gap-1 text-sm font-semibold"><span className={btn.primary + " size-20 rounded-full p-0"}><Home className="size-8" /></span>Start Trial</button>
      </div>
    </AppShell>
  );
}
