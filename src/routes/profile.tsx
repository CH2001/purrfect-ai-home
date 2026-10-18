import { cloudEnabled } from "@/lib/cloud/client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Home, MessageCircle, ShieldCheck, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell, DemoBadge, Logo, SectionTitle } from "@/components/app/shell";
import { resetAll, setState, useAppState } from "@/lib/repo/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Purrfect Home" },
      { name: "description", content: "Manage your account, check-in reminders, notifications and privacy." },
      { property: "og:title", content: "Your profile — Purrfect Home" },
      { property: "og:description", content: "Manage reminders, notifications and privacy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const name = useAppState((s) => s.userName);
  const versions = useAppState((s) => s.householdVersions.length);
  const push = useAppState((s) => s.review.pushEnabled);

  const togglePush = async () => {
    // FR-031: explicit browser permission before web push.
    // GCP/Firebase: const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FCM_VAPID_KEY });
    //               await api("/users/me/push-tokens", { method: "POST", body: JSON.stringify({ token }) });
    if (!push && typeof Notification !== "undefined") {
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast("Notifications weren't allowed — in-app reminders still work."); return; }
    }
    setState((s) => ({ ...s, review: { ...s.review, pushEnabled: !s.review.pushEnabled } }));
  };

  const rows = [
    { to: "/household", icon: Home, label: "Household profile", hint: `${versions} saved version${versions > 1 ? "s" : ""}` },
    { to: "/review", icon: CalendarClock, label: "Profile check-ins", hint: "Interval, snooze and history" },
    { to: "/onboarding", icon: MessageCircle, label: "Chat with Mimi", hint: "Describe changes in your own words" },
  ] as const;

  return (
    <AppShell>
      <Logo small />
      <div className="card-soft mt-4 flex items-center gap-3 p-4">
        <span className="grid size-14 place-items-center rounded-full bg-peach font-display text-2xl font-semibold text-accent">{name[0]}</span>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground" htmlFor="nm">Display name</label>
          <input id="nm" value={name} onChange={(e) => setState((s) => ({ ...s, userName: e.target.value }))} className="block w-full bg-transparent font-display text-xl font-semibold outline-none" />
        </div>
        <DemoBadge />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{cloudEnabled ? "Saved to this browser’s demo session. No login needed. Clearing browser data loses access to this session." : "Demo profile stored on this device."}</p>

      <SectionTitle title="Settings" />
      <ul className="card-soft divide-y divide-border">
        {rows.map(({ to, icon: I, label, hint }) => (
          <li key={to}><Link to={to} className="flex items-center gap-3 p-3"><I className="size-5 text-primary" /><span className="flex-1"><span className="block font-semibold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>›</Link></li>
        ))}
        <li className="flex items-center gap-3 p-3"><Bell className="size-5 text-primary" /><span className="flex-1"><span className="block font-semibold">Browser attention alerts</span><span className="text-xs text-muted-foreground">While this app is open · optional</span></span>
          <button role="switch" aria-checked={push} onClick={togglePush} className={"relative h-7 w-12 rounded-full transition " + (push ? "bg-success" : "bg-border")}><span className={"absolute top-1 size-5 rounded-full bg-card transition-all " + (push ? "left-6" : "left-1")} /></button></li>
      </ul>

      <SectionTitle title="Privacy" />
      <div className="card-soft space-y-3 p-3 text-sm">
        <p className="flex gap-2"><ShieldCheck className="size-5 shrink-0 text-success" />Your household details are only shared with a rescuer when you explicitly choose to, for a specific recipient and time.</p>
        <button className="flex items-center gap-2 font-semibold text-destructive" onClick={async () => { if (confirm("Delete all your trials, reports and household data? Your demo session will remain.")) { try { await resetAll(); toast.success("App data removed. You can start a fresh demo."); } catch { toast.error("Deletion failed. Please retry."); } } }}><Trash2 className="size-4" />Delete my data</button>
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">All animals, households and scores are fictional demo data — not real behavioural predictions.</p>
      <a href="/audio-credits.txt" className="mt-2 block text-center text-xs underline">Pet sound credits and licences</a>
    </AppShell>
  );
}
