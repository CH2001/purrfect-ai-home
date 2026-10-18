import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const cloudEnabled = import.meta.env.VITE_APP_MODE === "gcp";
export function firebaseAuth() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) throw new Error("Firebase browser configuration is incomplete. Follow GCP_SETUP.md.");
  return getAuth(getApps()[0] ?? initializeApp({ apiKey, projectId, appId, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN }));
}
export async function authHeaders(): Promise<Record<string, string>> {
  if (!cloudEnabled) return {};
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Please sign in.");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { method, headers: { ...await authHeaders(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? "Could not reach your account. Please sign in or retry.");
  }
  return response.json();
}
