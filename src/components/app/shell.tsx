import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Home, Search, PawPrint, Clock, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Provenance } from "@/lib/domain/types";

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Purrfect Home">
      <span className={cn("grid place-items-center rounded-xl bg-primary text-primary-foreground", small ? "size-8" : "size-10")}>
        <PawPrint className={small ? "size-4" : "size-5"} />
      </span>
      <span className={cn("font-display font-semibold leading-[0.9] text-primary", small ? "text-base" : "text-xl")}>
        Purrfect<br />Home
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: Home, sections: ["/"] },
  { to: "/discover", label: "Discover", icon: Search, sections: ["/discover", "/animals"] },
  { to: "/simulate", label: "Simulate", icon: PawPrint, sections: ["/simulate", "/trials"] },
  { to: "/history", label: "History", icon: Clock, sections: ["/history", "/report"] },
  { to: "/profile", label: "Profile", icon: User, sections: ["/profile", "/household", "/review", "/onboarding"] },
] as const;

export function AppShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  return (
    <div className="min-h-screen bg-muted/60">
      <div className="relative mx-auto min-h-screen w-full max-w-[440px] bg-background shadow-lift">
        <main className={cn("px-4 pt-4", nav ? "pb-28" : "pb-8")}>{children}</main>
        {nav && (
          <nav aria-label="Main navigation" className="glass fixed bottom-0 left-1/2 z-30 w-full max-w-[440px] -translate-x-1/2 border-t border-border px-2 pb-[env(safe-area-inset-bottom)]">
            <ul className="grid grid-cols-5">
              {NAV.map(({ to, label, icon: Icon, sections }) => {
                const selected = sections.some(section => pathname === section || (section !== "/" && pathname.startsWith(section + "/")));
                return (
                <li key={to}>
                  <Link to={to} activeOptions={{ exact: true }} aria-current={selected ? "page" : undefined} resetScroll
                    className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent", selected ? "text-accent" : "text-muted-foreground")}>
                    <Icon className="size-5" />
                    {label}
                  </Link>
                </li>
              ); })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="mb-4 flex items-start gap-3">
      <button onClick={() => router.history.back()} aria-label="Back" className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-soft">
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Pips({ value, total = 5, tone = "success" }: { value: number; total?: number; tone?: "success" | "warning" | "info" | "accent" }) {
  const c = { success: "bg-success", warning: "bg-warning", info: "bg-info", accent: "bg-accent" }[tone];
  return (
    <div className="flex gap-1" aria-label={`${value} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < value ? c : "bg-border")} />
      ))}
    </div>
  );
}

const PROV: Record<Provenance, string> = {
  USER_REPORTED: "bg-info-soft text-info",
  SHELTER_VERIFIED: "bg-success-soft text-success",
  SIMULATED: "bg-lilac-soft text-lilac",
  UNKNOWN: "bg-warning-soft text-warning",
  DEMO_SYNTHETIC: "bg-peach text-accent",
};
export function ProvBadge({ p }: { p: Provenance }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", PROV[p])}>{p.replace("_", " ")}</span>;
}

export function DemoBadge() {
  return <span className="rounded-full bg-peach px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">Demo · Synthetic</span>;
}

export function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "danger" | "info" | "lilac" }) {
  const c = { muted: "bg-secondary text-secondary-foreground", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-destructive", info: "bg-info-soft text-info", lilac: "bg-lilac-soft text-lilac" }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", c)}>{children}</span>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export const btn = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 font-display font-medium text-primary-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-50",
  accent: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 font-display font-medium text-accent-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-50",
  ghost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 font-display font-medium text-foreground transition active:scale-[0.98] disabled:opacity-50",
};
