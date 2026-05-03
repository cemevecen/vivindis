import { useMemo, useState } from "react";
import { analyzeHeuristic, healthCheck } from "./api";

export function App() {
  const [lang, setLang] = useState("tr");
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const lines = useMemo(
    () =>
      paste
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    [paste],
  );

  async function ping() {
    try {
      const h = await healthCheck();
      setApiOk(h.status === "ok");
      setErr(null);
    } catch (e) {
      setApiOk(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (lines.length === 0) {
        setErr("Önce yorum metni yapıştırın (satır başına bir yorum).");
        setBusy(false);
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
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, letterSpacing: "-0.02em" }}>Vivindis</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
          Mağaza yorumu analizi — React (Vite) arayüz, FastAPI (`vivindis.web`) backend.
        </p>
      </header>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          boxShadow: "0 1px 3px rgb(15 23 42 / 8%)",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Dil{" "}
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
          <button type="button" onClick={() => void ping()}>
            API bağlantısını test et
          </button>
          {apiOk === true && <span style={{ color: "#15803d" }}>API ayakta</span>}
          {apiOk === false && <span style={{ color: "#b91c1c" }}>API yanıt vermiyor</span>}
        </div>
        {err && <p style={{ color: "#b91c1c", marginTop: "0.75rem" }}>{err}</p>}
      </section>

      <section
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1rem 1.25rem",
          boxShadow: "0 1px 3px rgb(15 23 42 / 8%)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Hızlı analiz (heuristic)</h2>
        <textarea
          style={{ width: "100%", minHeight: 160, padding: "0.6rem", font: "inherit" }}
          placeholder="Her satıra bir yorum yazın…"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" disabled={busy} onClick={() => void run()}>
            {busy ? "Çalışıyor…" : "Analiz et"}
          </button>
        </div>
      </section>

      {rows.length > 0 && (
        <section style={{ marginTop: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Sonuç ({rows.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0.4rem" }}>No</th>
                  <th style={{ padding: "0.4rem" }}>Yorum</th>
                  <th style={{ padding: "0.4rem" }}>Duygu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{String(r["No"] ?? "")}</td>
                    <td style={{ padding: "0.4rem", maxWidth: 420, wordBreak: "break-word" }}>
                      {String(r["Yorum"] ?? "")}
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      {String(r["Baskın Duygu"] ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#64748b" }}>
        Kurulum: <code>./scripts/bootstrap.sh</code> · Geliştirme: <code>./scripts/dev.sh</code> veya{" "}
        <code>make dev</code>
      </p>
    </div>
  );
}
