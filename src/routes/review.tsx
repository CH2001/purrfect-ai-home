import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MessageCircle, Pencil, BellOff, Clock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader, SectionTitle, btn } from "@/components/app/shell";
import { extractChanges } from "@/lib/ai/ai.functions";
import { mockExtractChanges } from "@/lib/ai/mock-llm";
import { activeHousehold, addMonths, getState, saveHouseholdVersion, setState, useAppState } from "@/lib/repo/store";
import type { ProposedChange, ReviewSettings } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import mimi from "@/assets/real-cat.png";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Profile check-in — Purrfect Home" },
      { name: "description", content: "Keep your household profile accurate with a quick periodic check-in." },
      { property: "og:title", content: "Profile check-in — Purrfect Home" },
      { property: "og:description", content: "A quick periodic check-in for your household profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Review,
});

// GCP: reminders are produced server-side — Cloud Scheduler (daily) → private Cloud Run worker
// queries profileReviewSettings where nextReviewDueAt <= now AND remindersEnabled, writes one
// inbox item per due window (idempotent doc id `${uid}_${nextReviewDueAt}`), and optionally
// sends an FCM web push with a generic body ("Time for your profile check-in") — no household data.

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
const rid = () => `rev_${Math.random().toString(36).slice(2, 9)}`;

function Review() {
  const hh = useAppState(activeHousehold);
  const review = useAppState((s) => s.review);
  const log = useAppState((s) => s.reviewLog);
  const [mode, setMode] = useState<"home" | "chat" | "diff">("home");
  const [text, setText] = useState("I now work from home on Wednesdays too, and my mum visits on office days.");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<(ProposedChange & { accepted: boolean })[]>([]);

  const updateReview = (p: Partial<ReviewSettings>, type?: ReviewEventType, extra?: { changedFields?: string[]; versionId?: string }) =>
    setState((s) => ({ ...s, review: { ...s.review, ...p }, reviewLog: type ? [{ reviewId: rid(), type, at: new Date().toISOString(), versionId: extra?.versionId ?? s.activeVersionId, changedFields: extra?.changedFields }, ...s.reviewLog] : s.reviewLog }));
  const reviewed = () => { const at = new Date().toISOString(); return { lastReviewedAt: at, nextReviewDueAt: addMonths(at, getState().review.intervalMonths), snoozedUntil: null, dismissedForWindow: null }; };

  const stillAccurate = () => { updateReview(reviewed(), "NO_CHANGE"); toast.success("Thanks! Logged a check-in — profile version unchanged."); };

  const analyse = async () => {
    setBusy(true);
    let r: ProposedChange[];
    try { r = await extractChanges({ data: { message: text, current: hh } }); } catch { r = mockExtractChanges(text, hh); }
    setChanges(r.map((c) => ({ ...c, accepted: true }))); setBusy(false); setMode("diff");
  };

  const confirm = () => {
    const acc = changes.filter((c) => c.accepted);
    if (!acc.length) { setMode("home"); return; }
    const patch = Object.assign({}, ...acc.map((c) => c.apply));
    const res = saveHouseholdVersion(patch, "PROFILE_REVIEW", hh.revision); // optimistic concurrency
    if (!res.ok) { toast.error(res.reason); return; }
    updateReview(reviewed(), "CONFIRMED_CHANGE", { changedFields: acc.map((c) => c.label), versionId: res.version!.versionId });
    toast.success(`Profile updated to ${res.version!.versionId}. Earlier reports keep their original snapshot.`);
    setMode("home"); setChanges([]);
  };

  return (
    <AppShell>
      <PageHeader title="Profile check-in" subtitle={`Last reviewed ${fmt(review.lastReviewedAt)} · ${hh.versionId}`} />

      <section className="card-soft p-4">
        <p className="text-sm text-muted-foreground">Next profile review on</p>
        <p className="font-display text-2xl font-semibold">{fmt(review.nextReviewDueAt)}</p>
        <p className="mt-3 text-xs font-bold text-muted-foreground">Check in every</p>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {([1, 3, 6, 12] as const).map((m) => (
            <button key={m} onClick={() => updateReview({ intervalMonths: m, nextReviewDueAt: addMonths(review.lastReviewedAt, m) }, "INTERVAL_CHANGED")} aria-pressed={review.intervalMonths === m}
              className={cn("min-h-10 rounded-full text-sm font-bold", review.intervalMonths === m ? "bg-primary text-primary-foreground" : "bg-secondary")}>{m} mo</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button className={btn.ghost + " min-h-9 px-3 text-xs"} onClick={() => { updateReview({ snoozedUntil: new Date(Date.now() + 7 * 864e5).toISOString() }, "REMINDER_SNOOZED"); toast("Snoozed for 7 days"); }}><Clock className="size-3.5" />Snooze 7 days</button>
          <button className={btn.ghost + " min-h-9 px-3 text-xs"} onClick={() => updateReview({ remindersEnabled: !review.remindersEnabled }, review.remindersEnabled ? "REMINDER_DISABLED" : undefined)}><BellOff className="size-3.5" />{review.remindersEnabled ? "Turn off reminders" : "Turn on reminders"}</button>
          <button className={btn.ghost + " min-h-9 px-3 text-xs"} onClick={() => updateReview({ nextReviewDueAt: new Date(Date.now() - 1000).toISOString(), snoozedUntil: null, dismissedForWindow: null })}>Demo: make due now</button>
        </div>
      </section>

      {mode === "home" && (
        <div className="mt-4 grid gap-2">
          <button className={btn.primary} onClick={stillAccurate}><CheckCircle2 className="size-4" />Everything is still accurate</button>
          <button className={btn.accent} onClick={() => setMode("chat")}><MessageCircle className="size-4" />Tell Mimi what changed</button>
          <Link to="/household" className={btn.ghost}><Pencil className="size-4" />Edit manually</Link>
        </div>
      )}

      {mode === "chat" && (
        <section className="card-soft mt-4 p-3">
          <div className="flex gap-2"><img src={mimi} alt="Mimi" className="size-12" width={816} height={816} /><p className="rounded-2xl bg-muted p-3 text-sm">What's changed at home since {fmt(review.lastReviewedAt)}? I'll only update what you mention.</p></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="What changed" className="mt-3 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-2 flex gap-2"><button className={btn.ghost + " flex-1"} onClick={() => setMode("home")}>Cancel</button><button className={btn.primary + " flex-1"} disabled={busy || !text.trim()} onClick={analyse}>{busy && <Loader2 className="size-4 animate-spin" />}Find changes</button></div>
        </section>
      )}

      {mode === "diff" && (
        <section className="mt-4">
          <SectionTitle title="Proposed changes" />
          {changes.length === 0 && <p className="card-soft p-3 text-sm text-muted-foreground">Mimi didn't find specific changes. Try rephrasing or edit manually.</p>}
          <ul className="space-y-2">
            {changes.map((c, i) => (
              <li key={c.field} className={cn("card-soft p-3 text-sm", !c.accepted && "opacity-60")}>
                <div className="flex items-center justify-between"><b>{c.label}</b>
                  <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={c.accepted} onChange={(e) => setChanges(changes.map((x, j) => (j === i ? { ...x, accepted: e.target.checked } : x)))} />Apply</label></div>
                <p className="mt-1 text-xs text-muted-foreground line-through">{c.before}</p>
                <p className="flex items-center gap-1 text-xs font-semibold text-success"><ArrowRight className="size-3" />{c.after}</p>
                {c.quote && <p className="mt-1 text-[11px] italic text-muted-foreground">“{c.quote}” · user reported</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">AI suggestions are never saved without your confirmation.</p>
          <div className="mt-3 flex gap-2"><button className={btn.ghost + " flex-1"} onClick={() => setMode("chat")}>Back</button><button className={btn.primary + " flex-1"} onClick={confirm}>Confirm changes</button></div>
        </section>
      )}

      <SectionTitle title="Review history" />
      <ol className="space-y-1.5">
        {log.map((e) => (
          <li key={e.reviewId} className="card-soft flex items-center justify-between p-2.5 text-xs">
            <span><b>{e.type.replace(/_/g, " ").toLowerCase()}</b>{e.changedFields?.length ? ` — ${e.changedFields.join(", ")}` : ""}</span>
            <span className="text-muted-foreground">{new Date(e.at).toLocaleDateString()} · {e.versionId}</span>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}

type ReviewEventType = "NO_CHANGE" | "CONFIRMED_CHANGE" | "REMINDER_SNOOZED" | "REMINDER_DISABLED" | "INTERVAL_CHANGED";
