import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, Home, CalendarDays, PawPrint, Trash2, Plus, Volume2, DoorOpen, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, ProvBadge, btn } from "@/components/app/shell";
import { activeHousehold, getState, saveHouseholdVersion, useAppState } from "@/lib/repo/store";
import { DAYS, type Day, type HouseholdVersion, type ResidentPet, type ScheduleType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import catImg from "@/assets/sprite-cat.png";
import dogImg from "@/assets/sprite-dog.png";

export const Route = createFileRoute("/household")({
  head: () => ({
    meta: [
      { title: "Your household — Purrfect Home" },
      { name: "description", content: "Edit your weekly routine, home environment and existing pets." },
      { property: "og:title", content: "Your household — Purrfect Home" },
      { property: "og:description", content: "Your weekly routine, home and current pets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HouseholdPage,
});

const TYPE_COPY: Record<ScheduleType, { label: string; tone: string }> = {
  WORK_AWAY: { label: "Office", tone: "bg-peach" },
  WORK_FROM_HOME: { label: "Work from home", tone: "bg-success-soft" },
  HOME_ALL_DAY: { label: "Home all day", tone: "bg-info-soft" },
  HOME_REST: { label: "Home", tone: "bg-info-soft" },
  AWAY: { label: "Away", tone: "bg-danger-soft" },
};

function dayType(h: HouseholdVersion, d: Day) {
  return h.weeklySchedule.find((b) => b.days.includes(d) && b.type !== "HOME_REST") ?? { days: [d], start: "00:00", end: "23:59", type: "HOME_ALL_DAY" as ScheduleType };
}

function Segmented<T extends string>({ value, options, onChange }: { value: T | null; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", value === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{l}</button>
      ))}
    </div>
  );
}

function HouseholdPage() {
  const saved = useAppState(activeHousehold);
  const [h, setH] = useState<HouseholdVersion>(saved);
  useEffect(() => setH(saved), [saved.versionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const nav = useNavigate();

  const setDay = (d: Day, type: ScheduleType) => {
    const blocks = h.weeklySchedule.map((b) => ({ ...b, days: b.days.filter((x) => x !== d || b.type === "HOME_REST") })).filter((b) => b.days.length);
    const cur = dayType(h, d);
    setH({ ...h, weeklySchedule: [...blocks, { days: [d], start: cur.start === "00:00" ? "09:00" : cur.start, end: cur.end === "23:59" ? "18:00" : cur.end, type }] });
  };
  const setPet = (i: number, p: Partial<ResidentPet>) => setH({ ...h, pets: h.pets.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const addPet = (species: ResidentPet["species"]) => setH({ ...h, pets: [...h.pets, { petId: `pet_${Date.now()}`, name: "New pet", species, ageMonths: null, energy: null, sociability: null, reactsToCats: null, catCohabitation: "UNKNOWN", observedBehaviors: [] }] });
  const awayDays = DAYS.filter((d) => dayType(h, d).type === "WORK_AWAY");
  const longAbsence = awayDays.length >= 3 && h.caregivers.length === 0;

  const save = () => {
    const res = saveHouseholdVersion(h, "MANUAL_EDIT", getState().householdVersions.find((v) => v.versionId === getState().activeVersionId)!.revision);
    if (!res.ok) { toast.error(res.reason); return; }
    toast.success(`Saved as profile ${res.version!.versionId}. Past reports keep their original snapshot.`);
    nav({ to: "/" });
  };

  return (
    <AppShell nav={false}>
      <PageHeader title="Your Household" subtitle="Help us understand your home and existing pets so we can find the perfect matches." />

      <section className="card-soft p-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-success-soft"><CalendarDays className="size-5 text-success" /></span><div><h2 className="font-semibold">Weekly Routine</h2><p className="text-xs text-muted-foreground">Tap a day to change it.</p></div></div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {DAYS.map((d) => {
            const b = dayType(h, d);
            const order: ScheduleType[] = ["WORK_AWAY", "WORK_FROM_HOME", "HOME_ALL_DAY"];
            return (
              <button key={d} onClick={() => setDay(d, order[(order.indexOf(b.type) + 1) % order.length])} className={cn("flex flex-col items-center gap-1 rounded-xl p-1.5 text-center", TYPE_COPY[b.type].tone)} aria-label={`${d}: ${TYPE_COPY[b.type].label}`}>
                <span className="text-[11px] font-bold">{d.slice(0, 2)}</span>
                {b.type === "WORK_AWAY" ? <Briefcase className="size-4" /> : <Home className="size-4" />}
                <span className="text-[9px] leading-tight">{TYPE_COPY[b.type].label}</span>
              </button>
            );
          })}
        </div>
        {longAbsence && <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-warning-soft p-2 text-xs font-semibold text-warning"><AlertTriangle className="size-4" />{awayDays.length} long office days with no caregiver — consider care cover.</p>}
      </section>

      <section className="card-soft mt-3 p-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-info-soft"><Home className="size-5 text-info" /></span><h2 className="font-semibold">Home Environment</h2></div>
        <div className="mt-3 space-y-3 text-sm">
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Home className="size-3.5" />Home type</p><Segmented value={h.homeType} options={[["APARTMENT", "Apartment"], ["CONDO", "Condo"], ["HOUSE", "House"], ["TERRACE", "Terrace"]]} onChange={(v) => setH({ ...h, homeType: v })} /></div>
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><DoorOpen className="size-3.5" />Separate room available</p><Segmented value={h.safeRoomAvailable === null ? "UNK" : h.safeRoomAvailable ? "Y" : "N"} options={[["Y", "Yes"], ["N", "No"], ["UNK", "Not sure"]]} onChange={(v) => setH({ ...h, safeRoomAvailable: v === "UNK" ? null : v === "Y" })} /></div>
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Volume2 className="size-3.5" />Noise level</p><Segmented value={h.noiseLevel} options={[["LOW", "Low"], ["MODERATE", "Moderate"], ["HIGH", "High"]]} onChange={(v) => setH({ ...h, noiseLevel: v })} /></div>
          <div><p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" />Additional caregiver</p><Segmented value={h.caregivers.length ? "Y" : "N"} options={[["N", "None"], ["Y", "Yes, on office days"]]} onChange={(v) => setH({ ...h, caregivers: v === "Y" ? [{ name: "Caregiver", days: awayDays }] : [] })} /></div>
          <div><p className="mb-1 text-xs text-muted-foreground">Resources at home</p><div className="flex flex-wrap gap-1">
            {["WATER_BOWL", "FOOD_BOWL", "HIDE_BOX", "REST_BED", "TOY"].map((r) => (
              <button key={r} onClick={() => setH({ ...h, resources: h.resources.includes(r) ? h.resources.filter((x) => x !== r) : [...h.resources, r] })} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", h.resources.includes(r) ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground line-through")}>{r.toLowerCase().replace("_", " ")}</button>
            ))}</div></div>
        </div>
      </section>

      <section className="card-soft mt-3 p-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-peach"><PawPrint className="size-5 text-accent" /></span><div><h2 className="font-semibold">Existing Pet</h2><p className="text-xs text-muted-foreground">Tell us about your current pet(s).</p></div></div>
        {h.pets.map((p, i) => (
          <div key={p.petId} className="mt-3 flex gap-3">
            <div className="w-24 shrink-0 rounded-2xl bg-peach p-1"><img src={p.species === "DOG" ? dogImg : catImg} alt="" className="w-full" width={816} height={816} /></div>
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between"><input value={p.name} onChange={(e) => setPet(i, { name: e.target.value })} className="w-24 bg-transparent font-display text-lg font-semibold outline-none" aria-label="Pet name" /><button aria-label="Remove pet" onClick={() => setH({ ...h, pets: h.pets.filter((_, j) => j !== i) })} className="grid size-8 place-items-center rounded-full bg-danger-soft"><Trash2 className="size-4 text-destructive" /></button></div>
              <div><p className="mb-0.5 font-semibold">Species</p><Segmented value={p.species} options={[["CAT", "Cat"], ["DOG", "Dog"]]} onChange={(v) => setPet(i, { species: v })} /></div>
              <p className="text-muted-foreground">{p.breed ? `${p.breed}` : "Mixed"}</p>
              <div><p className="mb-0.5 font-semibold">Energy level</p><Segmented value={p.energy} options={[["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"]]} onChange={(v) => setPet(i, { energy: v })} /></div>
              <div><p className="mb-0.5 font-semibold">Reacts to cats</p><Segmented value={p.reactsToCats} options={[["IGNORES", "Ignores"], ["CURIOUS", "Curious"], ["BARKS", "Barks"], ["CHASES", "Chases"]]} onChange={(v) => setPet(i, { reactsToCats: v })} /></div>
              <div><p className="mb-0.5 flex items-center gap-1 font-semibold">Cat cohabitation {p.catCohabitation === "UNKNOWN" && <ProvBadge p="UNKNOWN" />}</p><Segmented value={p.catCohabitation} options={[["GOOD", "Good"], ["UNSURE", "Unsure"], ["NOT_SUITABLE", "Not suitable"], ["UNKNOWN", "Unknown"]]} onChange={(v) => setPet(i, { catCohabitation: v })} /></div>
            </div>
          </div>
        ))}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => addPet("CAT")} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-semibold"><Plus className="size-4" />Add a Cat</button>
          <button onClick={() => addPet("DOG")} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-semibold"><Plus className="size-4" />Add a Dog</button>
        </div>
      </section>

      <button className={btn.primary + " mt-4 w-full"} onClick={save}>Save Household Profile →</button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Currently {saved.versionId} · saving creates a new version</p>
    </AppShell>
  );
}
