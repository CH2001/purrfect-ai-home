import { envelopeSchema } from "@/lib/domain/validation";
import { CommandError } from "@/lib/repo/commands";
import { requireUser } from "./firebase";
import { deleteData, mutate, readState } from "./repository";
import { dispatchReminders } from "./reminders";
import { z } from "zod";

export async function handleApi(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/health") return Response.json({ status: "ok" });
  if (process.env.SERVICE_MODE === "worker") {
    // This service is private at Cloud Run IAM. No public invoker binding is created.
    if (path !== "/internal/reminders" || request.method !== "POST") return new Response("Not found", { status: 404 });
    return Response.json(await dispatchReminders());
  }
  if (path.startsWith("/internal/")) return new Response("Not found", { status: 404 });
  if (!path.startsWith("/api/v1/")) return null;
  if (process.env.APP_MODE !== "gcp") return new Response("Cloud mode disabled", { status: 404 });
  try {
    const uid = await requireUser(request);
    let result: unknown;
    if (path === "/api/v1/state" && request.method === "GET") result = await readState(uid);
    else if (path === "/api/v1/commands" && request.method === "POST") {
      if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return new Response("JSON required", { status: 415 });
      const reader = request.body?.getReader();
      if (!reader) return new Response("Body required", { status: 400 });
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) { await reader.cancel(); return new Response("Request too large", { status: 413 }); } chunks.push(value); }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return new Response("Invalid JSON", { status: 400 }); }
      result = await mutate(uid, envelopeSchema.parse(body));
    } else if (path === "/api/v1/data" && request.method === "DELETE") { await deleteData(uid); result = { deleted: true }; }
    else return new Response("Not found", { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid request fields" }, { status: 400 });
    if (error instanceof CommandError) return Response.json({ error: error.message }, { status: error.status });
    console.error(JSON.stringify({ event: "api_error", path }));
    return Response.json({ error: "Could not save your data. Please retry." }, { status: 500 });
  }
}
