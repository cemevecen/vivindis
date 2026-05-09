import type { AppDto } from "@/types/app";
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
export type DatePresetId = "7d" | "30d" | "90d" | "180d" | "365d" | "2y" | "5y" | "all";
export type ReviewScope = "local" | "global";
export type AnalysisMode = "fast" | "rich";

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset: DatePresetId): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "all") {
    return { from: "2000-01-01", to: isoDate(to) };
  }
  if (preset === "180d") {
    from.setMonth(from.getMonth() - 6);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === "2y") {
    from.setFullYear(from.getFullYear() - 2);
    return { from: isoDate(from), to: isoDate(to) };
  }
  if (preset === "5y") {
    from.setFullYear(from.getFullYear() - 5);
    return { from: isoDate(from), to: isoDate(to) };
  }
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

/** Kayıtlı uygulamayı mağaza pin kartı / arama sonucu gösterimi için sentetik mağaza satırına çevirir. */
export function storeHitFromRegisteredApp(app: AppDto): StoreSearchResultItem | null {
  if (app.platform === "google_play") {
    if (!app.package_name.trim()) {
      return null;
    }
    return {
      id: app.package_name,
      name: app.name,
      developer: app.developer,
      icon: app.icon_url,
      rating: null,
      review_count: null,
      platform: "google_play",
      store_url: null,
    };
  }
  if (app.platform === "app_store") {
    const bid = app.bundle_id?.trim();
    if (!bid) {
      return null;
    }
    return {
      id: bid,
      name: app.name,
      developer: app.developer,
      icon: app.icon_url,
      rating: null,
      review_count: null,
      platform: "app_store",
      store_url: null,
    };
  }
  if (app.package_name.trim()) {
    return {
      id: app.package_name,
      name: app.name,
      developer: app.developer,
      icon: app.icon_url,
      rating: null,
      review_count: null,
      platform: "google_play",
      store_url: null,
    };
  }
  const bundleOnly = app.bundle_id?.trim();
  if (bundleOnly) {
    return {
      id: bundleOnly,
      name: app.name,
      developer: app.developer,
      icon: app.icon_url,
      rating: null,
      review_count: null,
      platform: "app_store",
      store_url: null,
    };
  }
  return null;
}
