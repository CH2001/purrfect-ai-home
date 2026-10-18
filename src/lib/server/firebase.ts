import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function adminApp() {
  if (process.env.K_SERVICE && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) throw new Error("Emulators must not be enabled on Cloud Run.");
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is required.");
  return getApps()[0] ?? initializeApp({ projectId, credential: applicationDefault() });
}
export function database() { return getFirestore(adminApp()); }
export async function requireUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Response("Sign in required", { status: 401 });
  try {
    const token = await getAuth(adminApp()).verifyIdToken(header.slice(7), true);
    if (token.firebase.sign_in_provider === "anonymous" && process.env.DEMO_GUEST_ACCESS !== "true") throw new Error("Guest access disabled");
    return token.uid;
  } catch { throw new Response("Session expired. Sign in again.", { status: 401 }); }
}
