/** Worker `result` JSON — grafikler için güvenli okuma. */

export type SentimentRow = { name: string; value: number };

export type RatingRow = { rating: string; count: number };

export type TopicRow = { topic: string; count: number };

export function sentimentFromResult(result: Record<string, unknown> | null | undefined): SentimentRow[] {
  if (!result || typeof result !== "object") {
    return [];
  }
  const raw = result.sentiment;
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const s = raw as Record<string, unknown>;
  const keys = ["positive", "neutral", "negative"] as const;
  return keys.map((k) => ({
    name: k,
    value: typeof s[k] === "number" ? s[k] : Number(s[k]) || 0,
  }));
}

export function ratingsFromResult(result: Record<string, unknown> | null | undefined): RatingRow[] {
  if (!result || typeof result !== "object") {
    return [];
  }
  const raw = result.rating_distribution;
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const rd = raw as Record<string, unknown>;
  return ["1", "2", "3", "4", "5"].map((rating) => ({
    rating,
    count: typeof rd[rating] === "number" ? rd[rating] : Number(rd[rating]) || 0,
  }));
}

export function topicsFromResult(result: Record<string, unknown> | null | undefined, limit = 10): TopicRow[] {
  if (!result || typeof result !== "object") {
    return [];
  }
  const raw = result.top_topics;
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: TopicRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const topic = typeof o.topic === "string" ? o.topic : "—";
    const count = typeof o.count === "number" ? o.count : Number(o.count) || 0;
    rows.push({ topic, count });
  }
  return rows.slice(0, limit);
}

export function overallScoreFromResult(result: Record<string, unknown> | null | undefined): number | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const v = result.overall_score;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
