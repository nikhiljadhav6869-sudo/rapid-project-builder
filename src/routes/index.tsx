import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { synthesize, generateCpp, type Workload } from "@/lib/morpheus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MORPHEUS — Self-Designing Data Structure Engine" },
      { name: "description", content: "Describe your workload. MORPHEUS models cost, selects a data structure and generates C++." },
      { property: "og:title", content: "MORPHEUS — Self-Designing Data Structure Engine" },
      { property: "og:description", content: "Workload-aware data structure synthesis with generated C++ code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const OPS = [
  ["insert", "Insert"],
  ["lookup", "Point lookup"],
  ["range", "Range scan"],
  ["del", "Delete"],
] as const;

function Index() {
  const [w, setW] = useState<Workload>({ insert: 30, lookup: 50, range: 15, del: 5, n: 1_000_000, ordered: false, memoryTight: false });
  const cands = useMemo(() => synthesize(w), [w]);
  const [sel, setSel] = useState<string | null>(null);
  const chosen = (cands.find((c) => c.id === sel) ?? cands[0])!;
  const max = Math.max(...cands.map((c) => c.cost));
  const code = generateCpp(chosen, w);
  const set = (p: Partial<Workload>) => setW((s) => ({ ...s, ...p }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-material backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight">MORPHEUS</span>
          <span className="text-xs text-muted-foreground">Workbench · Untitled workload</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[340px_1fr]">
        <section className="animate-rise">
          <h1 className="text-2xl font-semibold tracking-tight">Describe the workload</h1>
          <p className="mt-1 text-sm text-muted-foreground">Calm intelligence. Exceptional engineering.</p>

          <div className="surface mt-6 divide-y divide-border">
            {OPS.map(([k, label]) => (
              <label key={k} className="block px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{w[k]}%</span>
                </div>
                <input type="range" min={0} max={100} value={w[k]} onChange={(e) => set({ [k]: +e.target.value })} className="mt-2 w-full accent-primary" />
              </label>
            ))}
          </div>

          <div className="surface mt-4 divide-y divide-border text-sm">
            <label className="flex items-center justify-between px-4 py-3">
              <span>Elements</span>
              <select value={w.n} onChange={(e) => set({ n: +e.target.value })} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">
                {[1e4, 1e5, 1e6, 1e7, 1e8].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
              </select>
            </label>
            <Toggle label="Ordered iteration required" on={w.ordered} set={(v) => set({ ordered: v })} />
            <Toggle label="Memory constrained" on={w.memoryTight} set={(v) => set({ memoryTight: v })} />
          </div>
        </section>

        <section className="animate-rise space-y-6" style={{ animationDelay: "80ms" }}>
          <div className="surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Modeled cost per operation</h2>
              <span className="text-xs text-muted-foreground">lower is better · relative units</span>
            </div>
            <ul className="mt-4 space-y-2">
              {cands.map((c, i) => (
                <li key={c.id}>
                  <button onClick={() => setSel(c.id)} className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${chosen.id === c.id ? "bg-accent" : "hover:bg-muted"}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}{i === 0 && <span className="ml-2 text-xs font-normal text-success">Recommended</span>}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.cost}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(c.cost / max) * 100}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface p-5">
            <h2 className="text-sm font-semibold">{chosen.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{chosen.notes}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(chosen.ops).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted px-3 py-2">
                  <dt className="text-xs capitalize text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-xl bg-code-bg">
            <div className="flex items-center justify-between px-4 py-2.5 text-xs text-code-comment">
              <span>store.hpp · generated C++20</span>
              <button onClick={() => navigator.clipboard.writeText(code)} className="text-code-key hover:underline">Copy</button>
            </div>
            <pre className="overflow-x-auto px-4 pb-5 font-mono text-xs leading-relaxed text-code-fg">{code}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => set(!on)} className="flex w-full items-center justify-between px-4 py-3">
      <span>{label}</span>
      <span className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-success" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow-soft transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
