import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Heart, Stethoscope } from "lucide-react";
import { AppShell, Chip, DemoBadge, PageHeader, Pips, ProvBadge, SectionTitle, btn } from "@/components/app/shell";
import { ANIMALS, ANIMAL_IMAGES } from "@/lib/data/seed";
import { toggleFavorite, useAppState } from "@/lib/repo/store";
import { startTrialFor } from "./discover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/animals/$animalId")({
  loader: ({ params }) => {
    // GCP: GET /v1/animals/{id} on Cloud Run (approved listings only)
    const a = ANIMALS.find((x) => x.animalId === params.animalId);
    if (!a) throw notFound();
    return a;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Pet"} — Purrfect Home` },
      { name: "description", content: loaderData?.description ?? "Rescue pet profile" },
      { property: "og:title", content: `Meet ${loaderData?.name} — Purrfect Home` },
      { property: "og:description", content: loaderData?.description ?? "Rescue pet profile" },
    ],
  }),
  component: AnimalPage,
});

const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function AnimalPage() {
  const a = Route.useLoaderData();
  const fav = useAppState((s) => s.favorites.includes(a.animalId));
  const nav = useNavigate();
  return (
    <AppShell>
      <PageHeader title={a.name} subtitle={`${a.species === "CAT" ? "Cat" : "Dog"} · ${a.ageMonths} months · ${a.sex.toLowerCase()}`}
        right={<button aria-label="Save" onClick={() => toggleFavorite(a.animalId)} className="grid size-10 place-items-center rounded-full bg-card shadow-soft"><Heart className={cn("size-5 text-accent", fav && "fill-accent")} /></button>} />
      <img src={ANIMAL_IMAGES[a.animalId]} alt={a.name} className="card-soft aspect-square w-full object-cover" />
      <div className="mt-3 flex items-center gap-2"><DemoBadge />{a.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
      <p className="mt-3 text-sm">{a.description}</p>

      <SectionTitle title="Baseline traits" />
      <div className="card-soft divide-y divide-border">
        {Object.entries(a.baselineTraits).map(([k, t]) => (
          <div key={k} className="flex items-center gap-3 p-3 text-sm">
            <span className="w-36 font-semibold">{label(k)}</span>
            <div className="flex-1">{t.value === null ? <span className="text-xs font-bold text-warning">Unknown</span> : <Pips value={Math.round(t.value / 20)} tone="warning" />}</div>
            <ProvBadge p={t.source} />
          </div>
        ))}
      </div>

      <SectionTitle title="Observations" />
      <ul className="space-y-2">
        {a.verifiedObservations.map((o) => (
          <li key={o.code} className="card-soft flex items-center justify-between p-3 text-sm">
            <div><p className="font-semibold">{label(o.code.toLowerCase().replace(/_(.)/g, (_, c) => c.toUpperCase()))}</p><p className="text-xs text-muted-foreground">{o.context}</p></div>
            <ProvBadge p={o.source} />
          </li>
        ))}
      </ul>

      <div className="card-soft mt-4 flex gap-3 bg-info-soft p-3 text-sm">
        <Stethoscope className="size-5 shrink-0 text-info" />
        <p>Vaccination and sterilisation status: <b>unknown</b>. A vet review is required before adoption.</p>
      </div>

      <button className={btn.primary + " mt-6 w-full"} onClick={() => { const id = startTrialFor(a.animalId); if (id) nav({ to: "/trials/$trialId", params: { trialId: id } }); }}>
        Start 7-day trial with {a.name}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">An educational rehearsal — the rescuer always makes the final adoption decision.</p>
    </AppShell>
  );
}
