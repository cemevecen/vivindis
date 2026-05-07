import type { StoreSearchResultItem } from "@/types/store-search";

/** Mağaza arama + dosya/yapıştırma + karşılaştırma sekmeleri. */
export type AnalyzeHubMode = "store" | "file" | "text" | "compare";

export function parseAnalyzeHubMode(raw: string | null): AnalyzeHubMode {
  if (raw === "store" || raw === "file" || raw === "text" || raw === "compare") {
    return raw;
  }
  return "store";
}
export type SearchPlatform = "google_play" | "app_store" | "both";
export type DatePresetId = "7d" | "30d" | "90d" | "365d";
export type ReviewScope = "local" | "global";
export type AnalysisMode = "fast" | "rich";

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset: DatePresetId): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

export function buildNewAppQueryString(
  hit: StoreSearchResultItem,
  dates: { from: string; to: string },
): string {
  const p = new URLSearchParams();
  p.set("platform", hit.platform);
  if (hit.platform === "google_play") {
    p.set("package_name", hit.id);
  } else {
    p.set("bundle_id", hit.id);
  }
  p.set("name", hit.name);
  if (hit.developer) p.set("developer", hit.developer);
  if (hit.icon) p.set("icon_url", hit.icon);
  p.set("from_date", dates.from);
  p.set("to_date", dates.to);
  return p.toString();
}

export function appBodyFromHit(hit: StoreSearchResultItem): Record<string, unknown> {
  const plat = hit.platform === "app_store" ? "app_store" : "google_play";
  return {
    platform: plat,
    package_name: hit.platform === "google_play" ? hit.id : "",
    bundle_id: hit.platform === "app_store" ? hit.id : null,
    name: hit.name,
    developer: hit.developer ?? null,
    category: null,
    icon_url: hit.icon ?? null,
    is_active: true,
  };
}
