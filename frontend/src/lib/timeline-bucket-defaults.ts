import type { ReviewTimeBucketMode } from "@/lib/review-time-buckets";

/** Çekim aralığı (UTC günleri, uçlar dahil). */
export function daysInclusiveUtc(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`);
  const b = Date.parse(`${toIso}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000) + 1;
}

/**
 * Analyze hub ile aynı `from_date` sözleşmesi: "tümü" ön ayarı 2000-01-01 gönderir.
 * 7g/30g → günlük; 90g/180g → haftalık; >365 gün → aylık; tümü → yıllık (yalnızca bu durumda).
 */
export function defaultTimelineBucket(fromDate: string, toDate: string): {
  defaultMode: ReviewTimeBucketMode;
  showYear: boolean;
} {
  if (fromDate === "2000-01-01") {
    return { defaultMode: "year", showYear: true };
  }
  const span = daysInclusiveUtc(fromDate, toDate);
  if (span <= 31) {
    return { defaultMode: "day", showYear: false };
  }
  if (span <= 365) {
    return { defaultMode: "week", showYear: false };
  }
  return { defaultMode: "month", showYear: false };
}
