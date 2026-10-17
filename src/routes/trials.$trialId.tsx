import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Utensils, Feather, Box, Binoculars, ChevronDown, ChevronLeft, Heart, Lightbulb, BarChart3, AlertTriangle, Loader2, ScrollText, Sun, CloudSun, Sunset, Moon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Pips, btn } from "@/components/app/shell";
import { ACTION_COPY, ANIMAL_IMAGES, RULES } from "@/lib/data/seed";
import { applyCareAction, commitDay, moodLabel, previewEffects, scenarioFor } from "@/lib/sim/engine";
import { finalizeTrial } from "@/lib/sim/finalize";
import { liveDayEntries, phaseOf } from "@/lib/sim/daylife";
import { attentionNeed } from "@/lib/sim/attention";
import { upsertTrial, useAppState } from "@/lib/repo/store";
import type { ActionId, BehaviorLogEntry, DayLog, DayPhase, Trial } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import room from "@/assets/room.jpg";
import catSprite from "@/assets/real-cat.png";
import dogSprite from "@/assets/real-dog.png";
import { PetSoundToggle, usePetSound } from "@/components/app/pet-sound";
import { useFeatureTransition } from "@/components/app/feature-transition";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trials/$trialId")({
  head: () => ({
    meta: [
      { title: "Seven-day home trial — Purrfect Home" },
      { name: "description", content: "Care for your rescue companion through a simulated seven-day home trial." },
      { property: "og:title", content: "Seven-day home trial — Purrfect Home" },
      { property: "og:description", content: "A simulated seven-day home trial with a rescue pet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrialPage,
});

// Room anchor points (percent). Production: Phaser 3 isometric Tiled map with A* walk graph
// (Technical Spec §5). This lightweight DOM renderer is the accessible fallback (FR-019).
const SPOTS = {
  bed: { x: 14, y: 40, label: "Resting" },
  bowl: { x: 26, y: 36, label: "Eating" },
  box: { x: 86, y: 46, label: "Hiding" },
  rug: { x: 50, y: 60, label: "Exploring" },
  toy: { x: 40, y: 70, label: "Playing" },
  window: { x: 22, y: 22, label: "Window-watching" },
} as const;
type Spot = keyof typeof SPOTS;

function useAutonomousCat(trial: Trial | undefined, forced: Spot | null) {
  // Local visual behaviour selector — NO LLM in render loop (FR-011).
  const [spot, setSpot] = useState<Spot>("box");
  useEffect(() => {
    if (!trial) return;
    if (forced) { setSpot(forced); return; }
    const pick = () => {
      const s = trial.state;
      const u: Record<Spot, number> = {
        box: 0.7 * s.stress - 0.4 * (trial.snapshot.animal.baselineTraits.confidence?.value ?? 50) + (trial.snapshot.household.pets.length ? 10 : 0),
        bowl: 0.85 * s.hunger - 0.25 * s.stress,
        bed: 0.65 * (100 - s.energy),
        rug: 0.65 * s.curiosity - 0.35 * s.stress + 20,
        toy: s.curiosity * 0.4,
        window: 25,
      };
      // Behaviour changes are gradual: the current spot gets a strong staying bias.
      setSpot((cur) => {
        const entries = Object.entries(u).map(([k, v]) => [k, Math.max(1, v + Math.random() * 25 + (k === cur ? 70 : 0))] as const);
        const total = entries.reduce((a, [, v]) => a + v, 0);
        let r = Math.random() * total;
        for (const [k, v] of entries) { r -= v; if (r <= 0) return k as Spot; }
        return cur;
      });
    };
    pick();
    const id = setInterval(() => { if (!document.hidden) pick(); }, 9000);
    return () => clearInterval(id);
  }, [trial?.stateVersion, forced]); // eslint-disable-line react-hooks/exhaustive-deps
  return spot;
}

function TrialPage() {
  const { play } = usePetSound();
  const { run } = useFeatureTransition();
  const { trialId } = Route.useParams();
  const trial = useAppState((s) => s.trials.find((t) => t.trialId === trialId));
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [forced, setForced] = useState<Spot | null>(null);
  const [heart, setHeart] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [recap, setRecap] = useState<DayLog | null>(null);
  const nav = useNavigate();
  const spot = useAutonomousCat(trial, forced);
  const forceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastCare = useRef(Date.now());
  const alerted = useRef<string | null>(null);
  const actionRef = useRef<(id: ActionId, target: Spot) => void>(() => {});
  useEffect(() => { lastCare.current = Date.now(); alerted.current = null; }, [trial?.stateVersion]);
  useEffect(() => {
    if (!trial || trial.status !== "IN_PROGRESS") return;
    const id = setInterval(() => {
      const need = attentionNeed(trial, (Date.now() - lastCare.current) / 1000);
      if (!need || alerted.current === need.kind) return;
      alerted.current = need.kind;
      toast(need.title, {
        description: need.body,
        duration: 10000,
        action: { label: need.action === "FEED" ? "Feed" : "Check in", onClick: () => actionRef.current(need.action, need.action === "FEED" ? "bowl" : "rug") },
      });
      if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(need.title, { body: need.body });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [trial?.stateVersion, trial?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trial) return <AppShell nav={false}><p className="p-8 text-center text-muted-foreground">Loading trial…</p></AppShell>;
  if (trial.status === "COMPLETED") {
    return <AppShell><div className="p-8 text-center"><p className="font-display text-xl">Trial complete!</p><Link to="/report/$trialId" params={{ trialId }} className={btn.primary + " mt-4"}>View report</Link></div></AppShell>;
  }
  const a = trial.snapshot.animal;
  const pet = trial.snapshot.household.pets[0];
  const sc = scenarioFor(trial);
  if (!sc) return <AppShell><p className="p-8 text-center">This trial moment isn't available.</p></AppShell>;
  const s = trial.state;

  const doAction = (id: ActionId, target: Spot) => {
    const r = applyCareAction(trial, id, `${trial.trialId}:${trial.day}:${trial.stateVersion}:${id}`);
    if (!r.ok) { toast(r.reason); return; }
    upsertTrial(r.trial);
    play(a);
    setForced(target); setHeart((h) => h + 1);
    clearTimeout(forceTimer.current);
    forceTimer.current = setTimeout(() => setForced(null), 3500);
  };

  const choose = async (id: ActionId) => {
    if (busy) return;
    setBusy(true);
    const r = commitDay(trial, id, trial.day);
    if (!r.ok) { toast(r.reason); setBusy(false); return; }
    let next = r.trial;
    if (next.status === "COMPLETED") { next = await finalizeTrial(next); upsertTrial(next); nav({ to: "/report/$trialId", params: { trialId } }); return; }
    upsertTrial(next);
    setScenarioOpen(false); setBusy(false);
    setRecap(next.dayLogs?.[next.dayLogs.length - 1] ?? null);
  };

  const cat = SPOTS[spot];
  const tray: { id: ActionId; label: string; spot: Spot; tone: string; Icon: typeof Box }[] = [
    { id: "FEED", label: "Food", spot: "bowl", tone: "bg-success-soft", Icon: Utensils },
    { id: "PLAY", label: "Play", spot: "toy", tone: "bg-peach", Icon: Feather },
    { id: "ADD_RETREAT", label: "Retreat", spot: "box", tone: "bg-warning-soft", Icon: Box },
    { id: "OBSERVE", label: "Observe", spot: "rug", tone: "bg-info-soft", Icon: Binoculars },
  ];

  return (
    <AppShell nav={false}>
      <div className="flex items-center justify-between">
        <Link to="/" aria-label="Back" className="grid size-10 place-items-center rounded-full bg-card shadow-soft"><ChevronLeft className="size-5" /></Link>
        <PetSoundToggle />
        <div className="text-right"><span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">Day {trial.day} of 7</span><div className="mt-1.5 w-28"><Pips value={trial.day - 1} total={7} /></div></div>
      </div>

      <section className="card-soft mt-3 p-3">
        <button className="flex w-full items-center gap-3 text-left" onClick={() => setStatsOpen((v) => !v)} aria-expanded={statsOpen}>
          <img src={ANIMAL_IMAGES[a.animalId]} alt="" className="size-16 rounded-full object-cover ring-4 ring-peach" />
          <div className="flex-1"><p className="font-display text-2xl font-semibold">{a.name}</p><p className="text-sm text-muted-foreground">{moodLabel(s)}</p></div>
          <ChevronDown className={cn("size-5 transition", statsOpen && "rotate-180")} />
        </button>
        {statsOpen && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
            <div className="rounded-xl bg-success-soft p-2">Comfort<div className="mt-1"><Pips value={Math.round(s.environmentalComfort / 20)} /></div></div>
            <div className="rounded-xl bg-warning-soft p-2">Stress<div className="mt-1"><Pips value={Math.round(s.stress / 20)} tone="warning" /></div></div>
            <div className="rounded-xl bg-danger-soft p-2">Trust<div className="mt-1"><Pips value={Math.max(0, Math.round(s.humanTrust / 20))} tone="accent" /></div></div>
          </div>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">Game indices only — simulated, not behavioural measurements.</p>
      </section>

      <section className="relative mt-3 overflow-hidden rounded-3xl shadow-lift" aria-label="Trial room">
        <img src={room} alt="Cozy living room" className="block w-full" width={768} height={960} />
        {pet && (
          <div className="absolute bottom-[6%] left-[4%] flex flex-col items-center">
            <span className="mb-1 rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-bold">{pet.name} · separated</span>
            <Button variant="ghost" onClick={() => play(pet)} aria-label={`Hear ${pet.name}`} title={`Hear ${pet.name}`} className="h-auto p-0 hover:bg-transparent"><img src={pet.species === "CAT" ? catSprite : dogSprite} alt={`${pet.name}, resident ${pet.species.toLowerCase()}`} className={cn("w-20", trial.day === 4 && "animate-bob")} width={816} height={816} /></Button>
          </div>
        )}
        {pet && <div className="pointer-events-none absolute bottom-0 left-[28%] h-[30%] border-l-4 border-dashed border-card/80" aria-hidden />}
        <div className="absolute transition-all duration-[1600ms] ease-in-out" style={{ left: `${cat.x}%`, top: `${cat.y}%`, transform: "translate(-50%,-80%)" }}>
          {heart > 0 && <Heart key={heart} className="animate-pop absolute -top-5 left-1/2 size-6 -translate-x-1/2 fill-accent text-accent" />}
          <Button variant="ghost" onClick={() => play(a)} aria-label={`Hear ${a.name}`} title={`Hear ${a.name}`} className="h-auto p-0 hover:bg-transparent"><img src={a.species === "CAT" ? catSprite : dogSprite} alt={`${a.name} — ${cat.label}`} className={cn("w-20 drop-shadow-lg", spot === "box" && "scale-75 opacity-80")} width={816} height={816} /></Button>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-bold">{cat.label}</span>
        </div>
        {tray.map((t) => (
          <button key={t.id} onClick={() => doAction(t.id, t.spot)} aria-label={`${t.label} at ${SPOTS[t.spot].label}`}
            className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent/80 text-xs shadow-soft" style={{ left: `${SPOTS[t.spot].x + 5}%`, top: `${SPOTS[t.spot].y - 6}%` }}><t.Icon className="mx-auto size-4 text-accent-foreground" /></button>
        ))}
        <button onClick={() => run(() => setScenarioOpen(true))} className="glass absolute inset-x-3 bottom-3 flex items-center justify-between rounded-2xl p-3 text-left shadow-soft">
          <span><span className="block text-[10px] font-bold uppercase text-accent">Today's moment</span><span className="font-display font-semibold">{sc.title}</span></span>
          <span className={btn.primary + " min-h-9 px-4 text-sm"}>Open</span>
        </button>
      </section>

      <DayNightPane trial={trial} />

      <div className="card-soft mt-3 grid grid-cols-4 gap-2 p-2">
        {tray.map((t) => (
          <button key={t.id} onClick={() => doAction(t.id, t.spot)} className="flex flex-col items-center gap-1 text-xs font-bold">
            <span className={cn("grid size-14 place-items-center rounded-2xl text-2xl", t.tone)}><t.Icon className="size-6 text-primary" /></span>{t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Care for {a.name} as often as you like today</p>

      {scenarioOpen && <ScenarioSheet trial={trial} busy={busy} onClose={() => setScenarioOpen(false)} onChoose={choose} />}
      {recap && <DayRecapSheet log={recap} name={a.name} onClose={() => setRecap(null)} />}
    </AppShell>
  );
}

const PHASE_META: Record<DayPhase, { label: string; Icon: typeof Sun }> = {
  MORNING: { label: "Morning", Icon: Sun },
  MIDDAY: { label: "Midday", Icon: CloudSun },
  EVENING: { label: "Evening", Icon: Sunset },
  NIGHT: { label: "Night", Icon: Moon },
};

const KIND_DOT: Record<BehaviorLogEntry["kind"], string> = {
  VOCAL: "bg-info", FEEDING: "bg-success", BEHAVIOR: "bg-primary", LONELINESS: "bg-warning", ATTENTION: "bg-success", MISSED: "bg-destructive", REST: "bg-muted-foreground",
};

function LogRow({ e }: { e: BehaviorLogEntry }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span className="w-9 shrink-0 pt-0.5 font-bold text-muted-foreground">{e.at}</span>
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", KIND_DOT[e.kind])} aria-hidden />
      <span className={cn(e.kind === "MISSED" && "font-semibold text-destructive", e.kind === "LONELINESS" && "font-semibold text-warning")}>{e.text}</span>
    </li>
  );
}

/** Day & night simulation pane: live log for today plus full logs of completed days. */
function DayNightPane({ trial }: { trial: Trial }) {
  const used = trial.events.filter((e) => e.day === trial.day && e.kind === "ACTION").length;
  const approxMins = [8 * 60, 12 * 60, 16 * 60, 19 * 60, 22 * 60][Math.min(used, 4)];
  const phase = phaseOf(approxMins);
  const { label, Icon } = PHASE_META[phase];
  const past = [...(trial.dayLogs ?? [])].reverse();
  return (
    <section className="card-soft mt-3 p-3" aria-label="Day and night simulation log">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-display font-semibold"><ScrollText className="size-4 text-primary" /> Day & night</p>
        <span className="flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-bold"><Icon className="size-3" /> {label}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {liveDayEntries(trial).map((e, i) => <LogRow key={i} e={e} />)}
      </ul>
      {past.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-muted-foreground">Previous days ({past.length})</summary>
          {past.map((l) => (
            <div key={l.day} className="mt-2 border-t border-border pt-2">
              <p className="text-xs font-bold">Day {l.day}</p>
              <ul className="mt-1 space-y-1.5">{l.entries.map((e, i) => <LogRow key={i} e={e} />)}</ul>
            </div>
          ))}
        </details>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">Simulated daily rhythm — illustrative, not a behavioural measurement.</p>
    </section>
  );
}

/** Recap shown after each committed day: what the pet experienced and what the owner missed. */
function DayRecapSheet({ log, name, onClose }: { log: DayLog; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40" role="dialog" aria-modal aria-label={`Day ${log.day} recap`} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <span className="rounded-full bg-peach px-2 py-0.5 text-[10px] font-bold uppercase text-accent">🌙 Day {log.day} recap</span>
        <h2 className="mt-2 font-display text-2xl font-semibold">How {name}'s day went</h2>
        <div className="card-soft mt-3 p-3">
          <p className="font-display text-sm font-semibold">What {name} experienced</p>
          <ul className="mt-1.5 space-y-1.5">
            {log.experienced.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="card-soft mt-2 p-3">
          <p className="font-display text-sm font-semibold">What you missed</p>
          {log.missed.length === 0 ? (
            <p className="mt-1.5 flex items-center gap-2 text-xs"><CheckCircle2 className="size-3.5 text-success" /> Nothing — a well-covered day.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {log.missed.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />{t}</li>
              ))}
            </ul>
          )}
        </div>
        <button className={btn.primary + " mt-4 w-full"} onClick={onClose}>Continue to day {log.day + 1}</button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Simulated rehearsal — not a prediction of real behaviour.</p>
      </div>
    </div>
  );
}

function ScenarioSheet({ trial, busy, onClose, onChoose }: { trial: Trial; busy: boolean; onClose: () => void; onChoose: (id: ActionId) => void }) {
  const sc = scenarioFor(trial);
  const [sel, setSel] = useState<ActionId>(sc?.recommendedActionIds[0] ?? "OBSERVE");
  const { run } = useFeatureTransition();
  if (!sc) return null;
  const options: ActionId[] = [...sc.allowedActionIds, ...sc.prohibitedActionIds];
  const eff = previewEffects(trial, sel);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40" role="dialog" aria-modal aria-label={sc.title} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex gap-3">
          <div className="flex-1">
            <span className="rounded-full bg-peach px-2 py-0.5 text-[10px] font-bold uppercase text-accent">🐾 Scenario moment · Day {trial.day}</span>
            <h2 className="mt-2 text-2xl font-semibold">{sc.title}</h2>
            <p className="text-sm text-muted-foreground">{sc.narrative}</p>
          </div>
          <div className="w-28 shrink-0 rotate-2 rounded-xl bg-warning-soft p-2 text-[11px]"><Lightbulb className="mb-1 size-4 text-warning" />Take a moment to choose the best next step for {trial.snapshot.animal.name}.</div>
        </div>
        <div className="mt-4 space-y-2">
          {options.map((id) => {
            const prohibited = sc.prohibitedActionIds.includes(id);
            const rec = sc.recommendedActionIds.includes(id);
            return (
              <button key={id} disabled={prohibited} onClick={() => setSel(id)} aria-pressed={sel === id}
                className={cn("w-full rounded-2xl border-2 p-3 text-left transition", prohibited ? "border-dashed border-destructive/40 bg-danger-soft opacity-80" : sel === id ? "border-success bg-success-soft" : "border-border bg-card")}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("font-display font-semibold", prohibited && "text-muted-foreground")}>{ACTION_COPY[id].title}</span>
                  {rec && <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Recommended</span>}
                </div>
                <p className="text-sm text-muted-foreground">{ACTION_COPY[id].body}</p>
                {prohibited && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="size-3.5" /> Not recommended — locked by introduction safeguards.</p>}
              </button>
            );
          })}
        </div>
        <div className="card-soft mt-3 grid grid-cols-2 gap-3 p-3 text-xs">
          <div><p className="font-display font-semibold">🎓 Why this matters</p><p className="mt-1 text-muted-foreground">Gradual introductions and safe retreat spaces help pets feel in control and reduce stress.</p></div>
          <div><p className="flex items-center gap-1 font-display font-semibold"><BarChart3 className="size-3.5" /> Projected effects</p>
            <p className="mt-1 flex justify-between">Comfort <b className="text-success">{eff.comfort >= 0 ? "+" : ""}{eff.comfort}</b></p>
            <p className="flex justify-between">Stress <b className="text-accent">{eff.stress >= 0 ? "+" : ""}{eff.stress}</b></p>
            <p className="flex justify-between">Familiarity <b className="text-info">{eff.familiarity >= 0 ? "+" : ""}{eff.familiarity}</b></p>
          </div>
        </div>
        <button className={btn.primary + " mt-4 w-full"} disabled={busy} onClick={() => run(() => onChoose(sel))}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}Confirm & end day {trial.day}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Simulated rehearsal — not a prediction of real behaviour.</p>
      </div>
    </div>
  );
}
