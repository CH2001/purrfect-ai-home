import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X, Send } from "lucide-react";
import { companionChat } from "@/lib/ai/ai.functions";
import { activeHousehold, useAppState } from "@/lib/repo/store";
import type { ChatTurn, PetSource } from "@/lib/ai/catalogue";

type Message = ChatTurn & { sources?: PetSource[]; source?: string };
export function PetChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Hi, I'm Mimi. Ask about a cat or dog, compare their personalities, or tell me what you want in a companion. I use our fictional pet catalogue and your saved household profile." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const home = useAppState(activeHousehold);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); else launcher.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function send(text = input) {
    text = text.trim();
    if (!text || busy) return;
    setError(""); setBusy(true); setInput("");
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text: text.slice(0, 3000) }));
    setMessages(items => [...items, { role: "user", text }]);
    try {
      const result = await companionChat({ data: { message: text.slice(0, 1000), history, current: home } });
      setMessages(items => [...items, { role: "assistant", text: result.reply, sources: result.sources, source: result.source }]);
    } catch { setError("Mimi couldn't answer. The connection or daily AI limit may be unavailable. Please retry later."); setInput(text); }
    finally { setBusy(false); }
  }
  return <>
    {/* Match AppShell's centered frame, keeping the surrounding page clickable. */}
    <div className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-full max-w-[440px] -translate-x-1/2 justify-end px-4">
      <button ref={launcher} aria-label="Ask Mimi about pets" onClick={() => setOpen(true)} className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg"><MessageCircle className="size-4" />Ask Mimi</button>
    </div>
    {open && <div className="fixed inset-y-0 left-1/2 z-[80] flex w-full max-w-[440px] -translate-x-1/2 items-end justify-center bg-black/40 p-2 sm:items-center" onClick={() => setOpen(false)}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Ask Mimi about pets" className="flex h-[85dvh] w-full max-w-md flex-col rounded-2xl bg-background shadow-xl" onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === "Escape") setOpen(false);
        if (e.key === "Tab") {
          const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)') ?? []);
          const first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
        <div className="flex items-center justify-between border-b p-4"><h2 className="font-display text-xl">Mimi · Pet guide</h2><button aria-label="Close pet chat" onClick={() => setOpen(false)}><X /></button></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-primary/10 p-3 text-sm" : "mr-4 rounded-xl bg-muted p-3 text-sm"}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.sources && <><p className="mt-2 text-[10px] text-muted-foreground">{m.source === "gemini" ? "Gemini · catalogue-grounded" : "Catalogue fallback · AI unavailable"} · synthetic demo data</p><div className="mt-2 space-y-2">{m.sources.map(s => <Link onClick={() => setOpen(false)} className="block rounded-lg border p-2 underline" key={s.id} to="/animals/$animalId" params={{ animalId: s.id }}>{s.name} · {s.species.toLowerCase()} · {s.ageMonths} months [{s.id}]</Link>)}</div></>}
          </div>)}
          {busy && <p role="status" className="text-sm">Mimi is checking the catalogue…</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div ref={end} />
        </div>
        <div className="flex flex-wrap gap-2 px-3 pb-2">{["Recommend a calm cat", "Tell me about Bumi", "Compare Oyen and Luna"].map(q => <button key={q} disabled={busy} onClick={() => void send(q)} className="rounded-full border px-2 py-1 text-xs">{q}</button>)}</div>
        <p className="px-4 text-[10px] text-muted-foreground">For saved household changes, use Profile. Clearing browser data loses your guest session.</p>
        <form className="flex gap-2 p-3" onSubmit={e => { e.preventDefault(); void send(); }}><input ref={inputRef} maxLength={1000} aria-label="Ask about a pet" placeholder="Ask about a pet…" value={input} onChange={e => setInput(e.target.value)} className="min-w-0 flex-1 rounded-full border bg-background px-3 py-2" /><button aria-label="Send pet question" disabled={busy || !input.trim()} className="rounded-full bg-primary p-3 text-primary-foreground"><Send className="size-4" /></button></form>
      </div>
    </div>}
  </>;
}
