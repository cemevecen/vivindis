import { apiHeaders, apiJson } from "@/shared/api/client";

export type AnalyzeRow = Record<string, unknown>;

export async function analyzeHeuristic(
  lang: string,
  reviews: { text: string; rating?: number | null }[],
): Promise<{ rows: AnalyzeRow[]; error?: string; count?: number }> {
  return apiJson("/api/v1/analyze", {
    method: "POST",
    headers: apiHeaders(lang),
    body: JSON.stringify({
      reviews: reviews.map((x) => ({ text: x.text, rating: x.rating ?? null })),
      use_heuristic_only: true,
      analysis_mode: 0,
    }),
  });
}
