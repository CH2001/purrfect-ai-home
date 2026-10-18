import { useEffect, useState, type ReactNode } from "react";
import { signInAnonymously } from "firebase/auth";
import { cloudEnabled, firebaseAuth } from "@/lib/cloud/client";
import { clearCloudState, hydrateCloud } from "@/lib/repo/store";

// Deduplicate initialization under StrictMode. Existing accounts remain usable.
let opening: Promise<void> | undefined;
function openGuest() {
  return opening ??= (async () => {
    const auth = firebaseAuth();
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    clearCloudState();
    await hydrateCloud();
  })().catch(error => { opening = undefined; throw error; });
}
export function CloudSession({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!cloudEnabled);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    void openGuest().then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  if (ready) return children;
  return <main className="mx-auto max-w-md p-6"><h1 className="font-display text-3xl">Purrfect Home</h1>
    {error ? <><p role="alert">The demo could not connect. Please check your connection and try again.</p><button className="mt-3 rounded bg-primary p-3 text-primary-foreground" onClick={() => window.location.reload()}>Retry demo</button></> : <p role="status">Opening your demo…</p>}
  </main>;
}
