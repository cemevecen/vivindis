import type { ReviewVolumePointDto } from "@/types/app-stats";

/** Seçilen [fromIso, toIso] aralığında günlük sayımlar (YYYY-MM-DD, UTC gün sınırı). */
export function buildDailyVolumePointsForRange(
  reviews: { review_date: string }[],
  fromIso: string,
  toIso: string,
): ReviewVolumePointDto[] {
  const fromMs = Date.parse(`${fromIso}T00:00:00.000Z`);
  const toMs = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return [];
  }
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const d = r.review_date;
    if (!d || d < fromIso || d > toIso) {
      continue;
    }
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const points: ReviewVolumePointDto[] = [];
  const cur = new Date(fromMs);
  while (cur.getTime() <= toMs) {
    const iso = cur.toISOString().slice(0, 10);
    points.push({ date: iso, count: counts.get(iso) ?? 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return points;
}
