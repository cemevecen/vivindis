import { useMemo, useState } from "react";
import { analyzeHeuristic } from "@/shared/api/analyze";
import type { AnalyzeRow } from "@/shared/api/analyze";

export function AnalyzePage() {
  const [lang, setLang] = useState("tr");
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<AnalyzeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lines = useMemo(
    () =>
      paste
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    [paste],
  );

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (lines.length === 0) {
        setErr("Önce yorum metni yapıştırın (satır başına bir yorum).");
        return;
      }
      const res = await analyzeHeuristic(lang, lines);
      if (res.error) {
        setErr(String(res.error));
        setRows([]);
      } else {
        setRows(res.rows ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Hızlı analiz</h1>
        <p className="mt-1 text-sm text-ink-muted">Heuristik mod — API anahtarı gerekmez.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-ink">Dil (API başlığı)</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="mt-2 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">Yorumlar</h2>
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          placeholder="Her satıra bir yorum…"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? "Çalışıyor…" : "Analiz et"}
        </button>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium">No</th>
                <th className="px-4 py-3 font-medium">Yorum</th>
                <th className="px-4 py-3 font-medium">Duygu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-4 py-3 align-top">{String(r["No"] ?? "")}</td>
                  <td className="max-w-md px-4 py-3 break-words">{String(r["Yorum"] ?? "")}</td>
                  <td className="whitespace-nowrap px-4 py-3">{String(r["Baskın Duygu"] ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Kurulum: <code>./scripts/bootstrap.sh</code> · Geliştirme: <code>./scripts/dev.sh</code>
      </p>
    </div>
  );
}
