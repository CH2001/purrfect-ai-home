import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Heart, X, Home, ShieldCheck, Cat, Dog, PawPrint, Sparkles, Undo2, ArrowLeft, ArrowRight, Check, CircleHelp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Chip, Logo, btn } from "@/components/app/shell";
import { ANIMALS, ANIMAL_IMAGES, ADOPTION_PROVIDERS } from "@/lib/data/seed";
import { activeHousehold, getState, setState, upsertTrial, useAppState } from "@/lib/repo/store";
import { createTrial } from "@/lib/sim/engine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { matchHousehold, swipeDecision } from "@/lib/discover-matching";
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
  const a = ANIMALS.find((x) => x.animalId === animalId);
  if (!a) { toast.error("This pet listing is unavailable."); return null; }
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
  const [ordering, setOrdering] = useState<"recommended" | "all">("recommended");
  const [drag, setDrag] = useState(0);
  const gesture = useRef<{ x: number; y: number; width: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const [last, setLast] = useState<{ animalId: string; name: string; saved: boolean; passed: boolean; idx: number; action: "save" | "pass" } | null>(null);
  const list = useMemo(() => {
    const pets = ANIMALS.filter((pet) => pet.status === "APPROVED" && (filter === "ALL" || pet.species === filter));
    return ordering === "recommended" ? pets.sort((left, right) => matchHousehold(right, hh).priority - matchHousehold(left, hh).priority) : pets;
  }, [filter, ordering, hh]);
  const a = list[idx % list.length];
  const next = list[(idx + 1) % list.length];
  const match = a ? matchHousehold(a, hh) : null;

  const decide = (action: "save" | "pass") => {
    if (!a) return;
    const state = getState();
    setLast({ animalId: a.animalId, name: a.name, saved: state.favorites.includes(a.animalId), passed: state.passed.includes(a.animalId), idx, action });
    setState((s) => ({ ...s,
      favorites: action === "save" ? [...new Set([...s.favorites, a.animalId])] : s.favorites,
      passed: action === "pass" ? [...new Set([...s.passed, a.animalId])] : s.passed.filter((id) => id !== a.animalId),
    }));
    setDrag(0);
    setIdx((i) => i + 1);
  };
  const undo = () => {
    if (!last) return;
    setState((s) => ({ ...s,
      favorites: last.saved ? [...new Set([...s.favorites, last.animalId])] : s.favorites.filter((id) => id !== last.animalId),
      passed: last.passed ? [...new Set([...s.passed, last.animalId])] : s.passed.filter((id) => id !== last.animalId),
    }));
    setIdx(last.idx); setLast(null); setDrag(0);
  };
  const start = () => { if (!a) return; const id = startTrialFor(a.animalId); if (id) nav({ to: "/trials/$trialId", params: { trialId: id } }); };

  return (
    <AppShell>
      <div className="flex items-center justify-between"><Logo small /><Link to="/history" aria-label="Saved" className="grid size-10 place-items-center rounded-full bg-card shadow-soft"><Heart className="size-5 fill-accent text-accent" /></Link></div>
      <h1 className="mt-3 text-center text-3xl font-semibold">Discover</h1>
      <p className="text-center text-sm text-muted-foreground">Find your purrfect companion</p>

      <div className="mt-4 grid grid-cols-3 rounded-full bg-card p-1 shadow-soft" role="tablist">
        {([["CAT", "Cats", Cat], ["DOG", "Dogs", Dog], ["ALL", "Mixed", PawPrint]] as const).map(([k, l, I]) => (
          <Button variant="ghost" key={k} role="tab" aria-selected={filter === k} onClick={() => { if (filter !== k) run(() => { setFilter(k); setIdx(0); setLast(null); setDrag(0); }); }}
            className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            <I className="size-4" />{l}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex gap-1" role="group" aria-label="Pet ordering">
          <Button variant={ordering === "recommended" ? "secondary" : "ghost"} size="sm" onClick={() => { setOrdering("recommended"); setIdx(0); setLast(null); }}><Sparkles />For your home</Button>
          <Button variant={ordering === "all" ? "secondary" : "ghost"} size="sm" onClick={() => { setOrdering("all"); setIdx(0); setLast(null); }}>All pets</Button>
        </div>
        <span className="text-xs text-muted-foreground">{a ? idx % list.length + 1 : 0} / {list.length}</span>
      </div>

      {a && <>
      <div className="relative isolate mt-4 grid grid-cols-[28px_minmax(0,1fr)_28px] items-stretch gap-2" data-testid="swipe-deck">
        <Button variant="ghost" aria-label="Save pet — swipe left" onClick={() => decide("save")} className={cn("h-full min-h-44 w-7 flex-col gap-3 rounded-full px-0 py-6 text-success hover:bg-success-soft hover:text-success", drag < -20 ? "bg-success-soft ring-2 ring-success" : "bg-success-soft/60")}>
          <ArrowLeft /><Heart /><span className="text-xs [writing-mode:vertical-rl]">Save</span>
        </Button>
        <div className="relative min-w-0">
          {list.length > 1 && <div className="card-soft pointer-events-none absolute inset-0 translate-y-1 rotate-2 overflow-hidden opacity-40"><img src={ANIMAL_IMAGES[next.animalId]} alt="" className="h-full w-full object-cover" /></div>}
          <div data-testid="swipe-card"
            className={cn("card-soft relative z-10 block touch-pan-y select-none overflow-hidden", drag === 0 && "transition-transform duration-200 motion-reduce:transition-none")}
            style={{ transform: `translateX(${drag}px) rotate(${drag / 22}deg)` }}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              suppressClick.current = false;
              gesture.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.offsetWidth, id: event.pointerId };
            }}
            onPointerMove={(event) => {
              const origin = gesture.current;
              if (!origin || event.pointerId !== origin.id) return;
              const dx = event.clientX - origin.x;
              const dy = event.clientY - origin.y;
              if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                suppressClick.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag(Math.max(-130, Math.min(130, dx)));
              }
            }}
            onPointerUp={(event) => {
              const origin = gesture.current;
              gesture.current = null;
              if (!origin) return;
              const action = swipeDecision(event.clientX - origin.x, event.clientY - origin.y, origin.width);
              if (action) { suppressClick.current = true; decide(action); }
              else setDrag(0);
            }}
            onPointerCancel={() => { gesture.current = null; setDrag(0); suppressClick.current = true; }}
            onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
          <Link key={a.animalId} to="/animals/$animalId" params={{ animalId: a.animalId }} className="block" draggable={false}>
            <div className="relative">
              <img src={ANIMAL_IMAGES[a.animalId]} alt={a.name} draggable={false} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-[10px] font-bold text-success"><ShieldCheck className="size-3" />Sample rescue listing</span>
              {favorites.includes(a.animalId) && <span className="absolute bottom-2 right-2 rounded-full bg-card p-2"><Heart className="size-4 fill-accent text-accent" /></span>}
              {Math.abs(drag) > 20 && <span className={cn("absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border-2 bg-card/95 p-3 text-center font-display text-xl font-semibold", drag < 0 ? "border-success text-success" : "border-accent text-accent")}>{drag < 0 ? "Save" : "Pass"}</span>}
            </div>
            <div className="p-3">
              <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-display text-2xl font-semibold">{a.name}</span><span className="text-xs text-muted-foreground">{a.ageMonths < 12 ? `${a.ageMonths} months` : `${Math.round(a.ageMonths / 12)} years`}</span></p>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{a.description}</p>
              <p className="mt-2 text-xs font-semibold text-primary">{ADOPTION_PROVIDERS[a.shelterId]?.name ?? "Adoption contact not provided"}</p>
              <div className="mt-2 flex flex-wrap gap-1">{a.tags.map((tag, i) => <Chip key={tag} tone={(["warning", "success", "danger"] as const)[i % 3]}>{tag}</Chip>)}</div>
            </div>
          </Link>
          </div>
        </div>
        <Button variant="ghost" aria-label="Pass pet — swipe right" onClick={() => decide("pass")} className={cn("h-full min-h-44 w-7 flex-col gap-3 rounded-full px-0 py-6 text-accent hover:bg-peach hover:text-accent", drag > 20 ? "bg-peach ring-2 ring-accent" : "bg-peach/60")}>
          <ArrowRight /><X /><span className="text-xs [writing-mode:vertical-rl]">Pass</span>
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button variant="secondary" onClick={() => decide("save")} className="h-11 rounded-full text-success"><Heart />Save</Button>
        <Button onClick={start} className={cn(btn.primary, "h-12 px-4")}><Home />Start Trial</Button>
        <Button variant="secondary" onClick={() => decide("pass")} className="h-11 rounded-full text-accent"><X />Pass</Button>
      </div>
      </>}
      <div className="mt-2 flex min-h-10 items-center justify-between gap-2" aria-live="polite">
        <p className="text-xs text-muted-foreground">{last ? `${last.name} ${last.action === "save" ? "saved to your shortlist" : "passed"}.` : "Saving a pet is not adoption approval."}</p>
        <Button variant="ghost" size="sm" disabled={!last} onClick={undo}><Undo2 />Undo</Button>
      </div>

      {match && <section className="mt-3 border-t border-border pt-4" aria-label="Household recommendations">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-warning" /><h2 className="font-display text-lg font-semibold">Your household fit</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Illustrative criteria match · Sample pet data, not a behaviour prediction.</p>
        <div className="mt-3 space-y-2">
          {match.reasons.map((reason) => <p key={reason} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-success" />{reason}</p>)}
          {match.cautions.map((caution) => <p key={caution} className="flex items-start gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />{caution}</p>)}
        </div>
        <details className="mt-3 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Confirm with the rescuer · {match.unknowns.length} unknowns</summary>
          <div className="mt-2 space-y-2">{match.unknowns.map((unknown) => <p key={unknown} className="flex items-start gap-2 text-xs text-muted-foreground"><CircleHelp className="size-4 shrink-0" />{unknown}</p>)}</div>
        </details>
        <Button asChild variant="link" className="mt-2 px-0"><Link to="/household">Update household criteria<ArrowRight /></Link></Button>
      </section>}
      {!a && <p className="py-12 text-center text-muted-foreground">No available pets in this category.</p>}
    </AppShell>
  );
}
