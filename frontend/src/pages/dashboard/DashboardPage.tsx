import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchHealth } from "@/shared/api/health";

export function DashboardPage() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ping() {
    try {
      const h = await fetchHealth();
      setApiOk(h.status === "ok");
      setErr(null);
    } catch (e) {
      setApiOk(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Özet</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Yerel geliştirme düzenin; üretimde aynı kod ve build{" "}
          <span className="font-medium text-ink">vivindis.com</span> arkasına taşınır.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-500"
          >
            Analize git
          </Link>
          <Link
            to="/store"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            Mağaza keşfi
          </Link>
          <button
            type="button"
            onClick={() => void ping()}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            API test
          </button>
        </div>
        {apiOk === true && (
          <p className="mt-4 text-sm font-medium text-emerald-700">API ayakta.</p>
        )}
        {apiOk === false && <p className="mt-4 text-sm font-medium text-red-700">API yanıt vermiyor.</p>}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            t: "Katmanlı backend",
            d: "Router → servis → `vivindis` çekirdek. OpenAPI `/docs`.",
          },
          { t: "Ölçeklenebilir UI", d: "Sayfalar `pages/`, ortak `shared/`, kabuk `widgets/`." },
          { t: "Taşınabilir", d: "Aynı repo; Docker / VPS / PaaS ile canlıya." },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-ink">{x.t}</h2>
            <p className="mt-2 text-sm text-ink-muted">{x.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
