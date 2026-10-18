import { ANIMAL_IMAGES } from "@/lib/data/images";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Heart, Stethoscope, Home, UserRound, Mail, Phone } from "lucide-react";
import { AppShell, Chip, DemoBadge, PageHeader, Pips, ProvBadge, SectionTitle, btn } from "@/components/app/shell";
import { ANIMALS, ADOPTION_PROVIDERS } from "@/lib/data/seed";
import { toggleFavorite, useAppState } from "@/lib/repo/store";
import { startTrialFor } from "./discover";
import { cn } from "@/lib/utils";
import { PetSoundToggle, usePetSound } from "@/components/app/pet-sound";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnimalPage,
});

const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function AnimalPage() {
  const { play } = usePetSound();
  const a = Route.useLoaderData();
  const provider = ADOPTION_PROVIDERS[a.shelterId];
  const ProviderIcon = provider?.type === "Individual rescuer" ? UserRound : Home;
  const fav = useAppState((s) => s.favorites.includes(a.animalId));
  const nav = useNavigate();
  return (
    <AppShell>
      <PageHeader title={a.name} subtitle={`${a.species === "CAT" ? "Cat" : "Dog"} · ${a.ageMonths} months · ${a.sex.toLowerCase()}`}
        right={<button aria-label="Save" onClick={() => toggleFavorite(a.animalId)} className="grid size-10 place-items-center rounded-full bg-card shadow-soft"><Heart className={cn("size-5 text-accent", fav && "fill-accent")} /></button>} />
      <img src={ANIMAL_IMAGES[a.animalId]} alt={a.name} className="card-soft aspect-square w-full object-cover" />
      <div className="mt-3 flex items-center justify-between"><Button variant="outline" onClick={() => play(a)}><Volume2 />Hear {a.name}</Button><PetSoundToggle /></div>
      <p className="mt-2 text-[10px] text-muted-foreground">Illustrative audio · age-adjusted; breed-size adjusted when known. Recordings by Dan Crosby and Amada44, <a className="underline" href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>.</p>
      <div className="mt-3 flex items-center gap-2"><DemoBadge />{a.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
      <p className="mt-3 text-sm">{a.description}</p>

      <section aria-label="Adoption contact" className="mt-5 border-y border-border py-4">
        <h2 className="text-lg font-semibold">Adoption contact</h2>
        <div className="mt-2 flex items-start gap-3">
          <ProviderIcon className="mt-1 size-5 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">{provider?.name ?? "Shelter or rescuer not provided"}</p>
            <p className="text-muted-foreground">{provider?.type ?? "Adoption provider"}{provider?.location ? ` · ${provider.location}` : ""}</p>
            {provider ? (
              <div className="mt-2 space-y-0.5 text-muted-foreground">
                <p className="flex items-center gap-1.5"><Mail className="size-3.5 shrink-0" /><span className="min-w-0 break-all">{provider.email}</span></p>
                <p className="flex items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{provider.phone}</p>
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">Contact details have not been provided.</p>
            )}
            {a.isDemo && <p className="mt-1 text-xs text-muted-foreground">Sample listing — this provider and its contact details are fictional and not a real adoption offer.</p>}
          </div>
        </div>
      </section>

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

      <button className={btn.primary + " mt-6 w-full"} onClick={async () => { const id = await startTrialFor(a.animalId); if (id) nav({ to: "/trials/$trialId", params: { trialId: id } }); }}>
        Start 7-day trial with {a.name}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">An educational rehearsal — the rescuer always makes the final adoption decision.</p>
    </AppShell>
  );
}
