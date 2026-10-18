import { useState } from "react";
import { FileText } from "lucide-react";
import { ANIMAL_IMAGES } from "@/lib/data/images";
import { ANIMALS } from "@/lib/data/seed";
import { Chip, Pips, btn } from "./shell";

// Presentation-only example: never inserted into a user's authoritative trials.
const AREAS = [
  { label: "Home resources", status: "Prepared", score: 5, detail: "A separate quiet room, hiding box, litter tray, food and water bowls are ready." },
  { label: "Daily care", status: "Needs attention", score: 2, detail: "One midday check-in was missed. Confirm backup care for office days." },
  { label: "Pet introductions", status: "Gradual plan", score: 3, detail: "Scent swapping began with the resident dog; direct contact has not been assessed." },
  { label: "Adoption readiness", status: "Preparation needed", score: 3, detail: "Keep the care routine consistent and arrange a rescuer-led meeting." },
];
const TIMELINE = [
  "Prepared a quiet room and allowed Oyen to hide and explore.",
  "Established morning and evening meals with short play sessions.",
  "Missed a midday check-in during an office day; backup care is needed.",
  "Introduced scent swapping while keeping the resident dog separated.",
  "Added a hiding box and offered interaction without forcing contact.",
  "Practised a caregiver check-in and maintained separate feeding areas.",
  "Reviewed the routine; a real-life introduction still needs rescuer guidance.",
];

export function SampleAdoptionHistory() {
  const [expanded, setExpanded] = useState(false);
  const animal = ANIMALS.find(a => a.name === "Oyen");
  if (!animal) return null;
  return <section aria-label="Sample adoption history" className="card-soft mt-4 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><Chip tone="info">Fictional sample</Chip><time dateTime="2026-10-18" className="text-xs text-muted-foreground">Updated 18 Oct 2026</time></div>
    <div className="mt-3 flex items-center gap-3">
      <img src={ANIMAL_IMAGES[animal.animalId]} alt="Oyen, sample adoption pet" className="size-20 rounded-2xl object-cover" />
      <div><h2 className="font-display text-xl font-semibold">Oyen · Sample history</h2><p className="text-xs text-muted-foreground">Completed virtual trial · 12–18 Oct 2026</p><p className="mt-1 text-sm font-semibold">Compatibility: preparation needed</p></div>
    </div>
    <p className="mt-3 text-sm">A promising routine with a quiet retreat and daily play. Backup care and gradual introductions still need attention.</p>
    <p className="mt-2 text-xs text-muted-foreground">Illustrative report for a fictional household, not your saved profile or a completed adoption. Scores show preparation, not compatibility probability.</p>
    <button aria-expanded={expanded} aria-controls="sample-compatibility-report" className={btn.primary + " mt-3 w-full"} onClick={() => setExpanded(value => !value)}><FileText className="size-4" />{expanded ? "Hide sample report" : "View sample compatibility report"}</button>
    {expanded && <div id="sample-compatibility-report" className="mt-4 space-y-4">
      <h3 className="font-display text-lg font-semibold">Sample compatibility status report</h3>
      <p className="text-sm"><b>Example household:</b> Two adults in an apartment with a separate room and one resident dog. Three office days each week; a caregiver can cover two of them.</p>
      <div className="grid grid-cols-2 gap-2">{AREAS.map(area => <div key={area.label} className="rounded-xl bg-muted p-3"><h4 className="text-sm font-bold">{area.label}</h4><p className="my-1 text-xs font-semibold">{area.status}</p><Pips value={area.score} /><p className="mt-2 text-xs text-muted-foreground">{area.detail}</p></div>)}</div>
      <div><h4 className="font-semibold">Strengths</h4><p className="text-sm">A quiet retreat, regular meals, short play sessions and separate spaces for each pet.</p></div>
      <div><h4 className="font-semibold">Concerns and next steps</h4><ul className="list-disc space-y-1 pl-5 text-sm"><li>Arrange reliable backup care for the remaining office day.</li><li>Continue separate spaces and scent exchange; ask the rescuer to assess introductions.</li><li>Confirm Oyen’s health records and observed behaviour with dogs before deciding.</li></ul></div>
      <div><h4 className="font-semibold">Seven-day sample timeline</h4><ol className="mt-2 space-y-2 text-sm">{TIMELINE.map((text, index) => <li key={text}><b>Day {index + 1}:</b> {text}</li>)}</ol></div>
      <p className="text-xs text-muted-foreground">Authored demo example, not an AI assessment or a simulation run. Real compatibility and health remain unverified; the rescuer makes the adoption decision.</p>
    </div>}
  </section>;
}
