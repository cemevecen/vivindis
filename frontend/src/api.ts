const headers = (lang: string) => ({
  "Content-Type": "application/json",
  "X-App-Lang": lang,
});

export async function healthCheck(): Promise<{ status: string }> {
  const r = await fetch("/api/v1/health");
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export async function analyzeHeuristic(
  lang: string,
  reviews: { text: string; rating?: number | null }[],
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const r = await fetch("/api/v1/analyze", {
    method: "POST",
    headers: headers(lang),
    body: JSON.stringify({
      reviews: reviews.map((x) => ({ text: x.text, rating: x.rating ?? null })),
      use_heuristic_only: true,
      analysis_mode: 0,
    }),
  });
  if (!r.ok) throw new Error(`analyze ${r.status}`);
  return r.json();
}
