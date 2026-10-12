import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, ProvBadge, btn } from "@/components/app/shell";
import { extractHousehold } from "@/lib/ai/ai.functions";
import { mockExtractHousehold, type ExtractionResult } from "@/lib/ai/mock-llm";
import { activeHousehold, getState, saveHouseholdVersion } from "@/lib/repo/store";
import type { HouseholdVersion } from "@/lib/domain/types";
import mimi from "@/assets/mimi.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Chat with Mimi — Purrfect Home" },
      { name: "description", content: "Tell Mimi, your AI adoption companion, about your home, routine and current pets." },
      { property: "og:title", content: "Chat with Mimi — Purrfect Home" },
      { property: "og:description", content: "Describe your home and routine in your own words." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type Msg = { role: "mimi" | "user"; text: string; at: string; extraction?: ExtractionResult };
const STEPS = ["Household Profile", "Lifestyle Match", "Pet Recommendations", "Next Steps"];
const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Onboarding() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "mimi", at: now(), text: "Hi there! I'm Mimi ❤️ I'll help you find a furry friend who fits your home and lifestyle. To get started, could you tell me a bit about your daily routine and any existing pets?" }]);
  const [input, setInput] = useState("I work in the office Mon-Wed 9 to 6, from home on Thu-Fri. I have a dog named Max who gets excited around cats.");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<HouseholdVersion>>({ safeRoomAvailable: null, noiseLevel: null, homeType: null });
  const [followUp, setFollowUp] = useState<ExtractionResult["followUp"]>(null);
  const [step, setStep] = useState(0);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, followUp]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text, at: now() }]);
    setInput(""); setBusy(true);
    let r: ExtractionResult;
    try { r = await extractHousehold({ data: { message: text, current: draft } }); }
    catch { r = mockExtractHousehold(text, draft); } // FR-014 offline fallback
    setDraft((d) => ({ ...d, ...r.patch }));
    setMsgs((m) => [...m, { role: "mimi", text: r.reply, at: now(), extraction: r.facts.length ? r : undefined }]);
    if (r.followUp) setMsgs((m) => [...m, { role: "mimi", text: "Great! One more question to help narrow down the best matches.", at: now() }]);
    setFollowUp(r.followUp); setBusy(false);
  };

  const answer = (opt: string) => {
    if (!followUp) return;
    const f = followUp.field;
    const patch: Partial<HouseholdVersion> = {};
    if (f === "safeRoomAvailable") patch.safeRoomAvailable = opt === "Yes" ? true : opt === "No" ? false : null;
    if (f === "homeType") patch.homeType = opt.toUpperCase() as HouseholdVersion["homeType"];
    if (f === "noiseLevel") patch.noiseLevel = opt.toUpperCase() as HouseholdVersion["noiseLevel"];
    if (f === "caregiver") patch.caregivers = opt === "Yes" ? [{ name: "Helper", days: ["MON", "TUE", "WED"] }] : [];
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    const done = new Set([...answered, f]);
    setAnswered(done);
    setMsgs((m) => [...m, { role: "user", text: opt, at: now() }]);
    // Pretend answered fields are known so the next prioritized question is asked ("Not sure" stays null/unknown)
    const probe: Partial<HouseholdVersion> = { ...nextDraft,
      ...(done.has("safeRoomAvailable") ? { safeRoomAvailable: nextDraft.safeRoomAvailable ?? false } : {}),
      ...(done.has("homeType") ? { homeType: nextDraft.homeType ?? "APARTMENT" } : {}),
      ...(done.has("noiseLevel") ? { noiseLevel: nextDraft.noiseLevel ?? "MODERATE" } : {}),
      ...(done.has("caregiver") ? { caregivers: [{ name: "-", days: [] }] } : {}) };
    const next = mockExtractHousehold("", probe).followUp;
    setFollowUp(next);
    if (!next) { setStep(1); setMsgs((m) => [...m, { role: "mimi", at: now(), text: "That's everything I need for now! Review your profile below and confirm when it looks right." }]); }
  };

  const confirm = () => {
    const cur = activeHousehold(getState());
    const res = saveHouseholdVersion({ ...draft, safeRoomAvailable: draft.safeRoomAvailable ?? cur.safeRoomAvailable }, "ONBOARDING", cur.revision);
    if (!res.ok) { toast.error(res.reason); return; }
    toast.success(`Household profile saved as ${res.version!.versionId}`);
    nav({ to: "/discover" });
  };

  return (
    <AppShell nav={false}>
      <PageHeader title="AI Companion" subtitle="Your personal adoption guide" />
      <ol className="mb-4 grid grid-cols-4 text-center text-[10px] font-semibold text-muted-foreground">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col items-center gap-1"><span className={cn("grid size-6 place-items-center rounded-full text-xs", i <= step ? "bg-primary text-primary-foreground" : "bg-border")}>{i + 1}</span>{s}</li>
        ))}
      </ol>

      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
            {m.role === "mimi" && <img src={mimi} alt="Mimi" className="size-12 shrink-0" width={816} height={816} />}
            <div className="max-w-[80%]">
              <div className={cn("rounded-2xl p-3 text-sm shadow-soft", m.role === "user" ? "rounded-br-sm bg-success-soft" : "rounded-tl-sm bg-card")}>{m.text}</div>
              <p className={cn("mt-0.5 text-[10px] text-muted-foreground", m.role === "user" && "text-right")}>{m.at}</p>
              {m.extraction && (
                <div className="card-soft mt-2 p-3">
                  <div className="flex items-center justify-between"><p className="font-display font-semibold">Your Household Profile</p><a href="/household" className="flex items-center gap-1 rounded-full bg-peach px-2 py-1 text-xs font-bold text-accent"><Pencil className="size-3" />Edit</a></div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {m.extraction.facts.map((f) => (
                      <div key={f.field} className="rounded-xl bg-muted p-2"><p className="text-[10px] text-muted-foreground">{f.label}</p><p className="text-xs font-bold">{f.value}</p><div className="mt-1"><ProvBadge p={f.provenance} /></div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {followUp && (
          <div className="card-soft ml-14 p-3">
            <p className="font-display font-semibold">{followUp.question}</p>
            <p className="text-xs text-muted-foreground">{followUp.hint}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {followUp.options.map((o, i) => (
                <button key={o} onClick={() => answer(o)} className={cn("min-h-10 rounded-full text-sm font-bold", ["bg-success-soft text-success", "bg-danger-soft text-destructive", "bg-warning-soft text-warning"][i % 3])}>{o}</button>
              ))}
            </div>
          </div>
        )}
        {busy && <p className="ml-14 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Mimi is thinking…</p>}
        <div ref={end} />
      </div>

      {msgs.some((m) => m.extraction) && !followUp && (
        <button className={btn.primary + " mt-4 w-full"} onClick={confirm}>Confirm & save household profile</button>
      )}

      <form className="sticky bottom-3 mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message Mimi…" aria-label="Message Mimi" className="min-h-12 flex-1 rounded-full border border-border bg-card px-4 text-sm shadow-soft outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" aria-label="Send" disabled={busy} className={btn.primary + " size-12 p-0"}><Send className="size-5" /></button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Privacy: your household details are used only to personalise your trials. Nothing is shared without your consent.</p>
    </AppShell>
  );
}
