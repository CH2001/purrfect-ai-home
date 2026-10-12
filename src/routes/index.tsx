import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Briefcase, Heart, Home as HomeIcon, PawPrint, CalendarClock, X } from "lucide-react";
import { AppShell, Chip, DemoBadge, Logo, Pips, SectionTitle, btn } from "@/components/app/shell";
import { ANIMALS, ANIMAL_IMAGES } from "@/lib/data/seed";
import { activeHousehold, reviewDue, setState, useAppState, addMonths } from "@/lib/repo/store";
import mimi from "@/assets/mimi.png";
import oyenSprite from "@/assets/sprite-cat.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Purrfect Home — Your adoption companion" },
      { name: "description", content: "Continue your virtual trial, discover rescue pets and keep your household profile up to date." },
      { property: "og:title", content: "Purrfect Home — Your adoption companion" },
      { property: "og:description", content: "Continue your virtual trial and discover adoptable rescue pets." },
    ],
  }),
  component: Index,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Index() {
  const name = useAppState((s) => s.userName);
  const trials = useAppState((s) => s.trials);
  const hh = useAppState(activeHousehold);
  const due = useAppState((s) => reviewDue(s));
  const nextDue = useAppState((s) => s.review.nextReviewDueAt);
  const active = trials.find((t) => t.status === "IN_PROGRESS");
  const away = hh.weeklySchedule.find((b) => b.type === "WORK_AWAY");
  const pet = hh.pets[0];

  return (
    <AppShell>
      <div className="flex items-start justify-between">
        <Logo />
        <Link to="/review" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full bg-card shadow-soft">
          <Bell className="size-5" />
          {due && <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" />}
        </Link>
      </div>
      <div className="relative mt-3">
        <p className="text-lg">{greeting()},</p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">{name} <Heart className="size-5 fill-accent text-accent" /></h1>
        <p className="text-sm text-muted-foreground">Different stories. Brighter tomorrows.</p>
        <img src={oyenSprite} alt="" className="absolute -top-6 right-0 w-28 animate-bob" width={816} height={816} />
      </div>

      {due && (
        <div className="card-soft mt-4 flex items-start gap-3 border-accent/40 p-3">
          <CalendarClock className="mt-0.5 size-5 text-accent" />
          <div className="flex-1 text-sm">
            <p className="font-bold">Time for your profile check-in</p>
            <p className="text-muted-foreground">Has anything changed at home? It takes a minute.</p>
            <div className="mt-2 flex gap-2">
              <Link to="/review" className={btn.accent + " min-h-9 px-4 text-sm"}>Review now</Link>
              <button className={btn.ghost + " min-h-9 px-4 text-sm"} onClick={() => setState((s) => ({ ...s, review: { ...s.review, snoozedUntil: addMonths(new Date().toISOString(), 0.25) } }))}>Snooze 7 days</button>
            </div>
          </div>
          <button aria-label="Dismiss" onClick={() => setState((s) => ({ ...s, review: { ...s.review, dismissedForWindow: s.review.nextReviewDueAt } }))}><X className="size-4" /></button>
        </div>
      )}

      <section className="card-soft relative mt-5 overflow-hidden p-4">
        {active ? (
          <>
            <Chip tone="success">Continue virtual trial</Chip>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-3xl font-semibold">{active.snapshot.animal.name}</h2>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">Day {active.day} of 7</span>
            </div>
            <p className="mt-1 max-w-[55%] text-sm text-muted-foreground">{active.snapshot.animal.description.split(".")[0]}.</p>
            <div className="mt-3 max-w-[55%]"><Pips value={active.day - 1} total={7} /></div>
            <Link to="/trials/$trialId" params={{ trialId: active.trialId }} className={btn.primary + " mt-4"}>Continue Trial <ArrowRight className="size-4" /></Link>
            <img src={ANIMAL_IMAGES[active.animalId]} alt={active.snapshot.animal.name} className="absolute -right-6 bottom-0 top-0 h-full w-1/2 object-cover [mask-image:linear-gradient(to_right,transparent,black_30%)]" />
          </>
        ) : (
          <>
            <Chip tone="success">Start a virtual trial</Chip>
            <h2 className="mt-2 text-2xl font-semibold">Rehearse 7 days at home</h2>
            <p className="mt-1 max-w-[60%] text-sm text-muted-foreground">Pick a rescue pet and practise care, routines and gentle introductions.</p>
            <Link to="/discover" className={btn.primary + " mt-4"}>Find a companion <ArrowRight className="size-4" /></Link>
            <img src={ANIMAL_IMAGES.cat_oyen} alt="" className="absolute -right-6 bottom-0 top-0 h-full w-1/2 object-cover [mask-image:linear-gradient(to_right,transparent,black_30%)]" />
          </>
        )}
      </section>

      <SectionTitle title="Discover adoptable pets" action={<Link to="/discover" className="text-sm font-bold text-accent">See all ›</Link>} />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {ANIMALS.map((a) => (
          <Link key={a.animalId} to="/animals/$animalId" params={{ animalId: a.animalId }} className="card-soft w-36 shrink-0 snap-start overflow-hidden">
            <img src={ANIMAL_IMAGES[a.animalId]} alt={a.name} className="aspect-square w-full object-cover" loading="lazy" />
            <div className="p-2.5">
              <p className="font-display font-semibold">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.species === "CAT" ? "Cat" : "Dog"} · {a.ageMonths < 12 ? `${a.ageMonths} months` : `${Math.round(a.ageMonths / 12)} yr`}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">{a.tags.slice(0, 2).map((t) => <Chip key={t} tone="success">{t}</Chip>)}</div>
            </div>
          </Link>
        ))}
      </div>

      <SectionTitle title="Your household" action={<Link to="/household" className="text-sm font-bold text-accent">Edit ›</Link>} />
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-success-soft p-3 text-xs"><Briefcase className="mb-1 size-5 text-success" /><p className="text-muted-foreground">Work schedule</p><p className="font-bold">{away ? `${away.start}–${away.end}` : "Flexible"}</p><p className="text-muted-foreground">{away ? `${away.days[0]}–${away.days.at(-1)}` : "Home"}</p></div>
        <div className="rounded-2xl bg-peach p-3 text-xs"><PawPrint className="mb-1 size-5 text-accent" /><p className="text-muted-foreground">Existing pet</p><p className="font-bold">{pet ? `1 ${pet.species.toLowerCase()} (${pet.name})` : "None"}</p></div>
        <div className="rounded-2xl bg-info-soft p-3 text-xs"><HomeIcon className="mb-1 size-5 text-info" /><p className="text-muted-foreground">Home type</p><p className="font-bold capitalize">{hh.homeType?.toLowerCase() ?? "Unknown"}</p>{hh.areaM2 && <p className="text-muted-foreground">~{hh.areaM2} m²</p>}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Profile {hh.versionId} · next check-in {new Date(nextDue).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>

      <section className="card-soft mt-5 flex items-center gap-3 bg-peach p-3">
        <img src={mimi} alt="Mimi" className="w-16" width={816} height={816} loading="lazy" />
        <div className="flex-1">
          <h3 className="font-semibold">AI Adoption Companion</h3>
          <p className="text-xs text-muted-foreground">Tell Mimi about your home and routine.</p>
        </div>
        <Link to="/onboarding" className={btn.accent + " min-h-9 px-3 text-sm"}>Chat Now</Link>
      </section>
      <div className="mt-4 flex justify-center"><DemoBadge /></div>
    </AppShell>
  );
}
