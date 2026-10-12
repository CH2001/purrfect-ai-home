import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import loadingAsset from "@/assets/oyen-loading.gif.asset.json";

const DURATION = 2500;
const TransitionContext = createContext({ busy: false, run: (_action: () => void) => {} });

/** Presentation-only delay: navigation/state authority remains outside this provider. */
export function FeatureTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [reducedMotion, setReducedMotion] = useState(false);
  const begin = useCallback(() => {
    setBusy(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBusy(false), DURATION);
  }, []);
  useEffect(() => {
    begin();
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    const unsubscribe = router.subscribe("onBeforeLoad", ({ pathChanged }) => { if (pathChanged) begin(); });
    return () => {
      unsubscribe(); query.removeEventListener("change", update);
      clearTimeout(timer.current); clearTimeout(actionTimer.current);
    };
  }, [router, begin]);
  const run = useCallback((action: () => void) => {
    if (active.current) return;
    active.current = true;
    begin();
    actionTimer.current = setTimeout(() => {
      active.current = false;
      action();
    }, DURATION);
  }, [begin]);
  return (
    <TransitionContext.Provider value={{ busy, run }}>
      <div inert={busy} aria-hidden={busy || undefined}>{children}</div>
      {busy && <div className="fixed inset-0 z-[100] grid place-items-center bg-background" role="status" aria-live="polite" aria-label="Loading">
        <div className="flex flex-col items-center">
          {!reducedMotion && <img src={loadingAsset.url} alt="" className="w-80 max-w-[85vw] mix-blend-multiply" width={400} height={300} />}
          <p className="font-display text-lg text-primary">Just a whisker…</p>
          <span className="sr-only">Loading, please wait.</span>
        </div>
      </div>}
    </TransitionContext.Provider>
  );
}

export const useFeatureTransition = () => useContext(TransitionContext);