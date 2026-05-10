import type { ReviewFetchDto } from "@/types/app";

export type MarketplaceSiteId = "trendyol" | "hepsiburada" | "n11";

export const MARKETPLACE_CHIP_SITES: MarketplaceSiteId[] = ["trendyol", "hepsiburada", "n11"];

/** next-intl keys under `analyzeHub` for marketplace brand names */
export const MARKETPLACE_CHIP_LABEL: Record<
  MarketplaceSiteId,
  "marketplaceBrandTrendyol" | "marketplaceBrandHepsiburada" | "marketplaceBrandN11"
> = {
  trendyol: "marketplaceBrandTrendyol",
  hepsiburada: "marketplaceBrandHepsiburada",
  n11: "marketplaceBrandN11",
};

/**
 * Best-effort site id from a marketplace seller fetch (profile URL in seller intelligence).
 * Returns null while running if intel is not persisted yet.
 */
export function inferMarketplaceSiteFromFetch(
  fetch: Pick<ReviewFetchDto, "source" | "seller_intelligence_json">,
): MarketplaceSiteId | null {
  if (fetch.source !== "marketplace_seller_tr") {
    return null;
  }
  const intel = fetch.seller_intelligence_json;
  if (!intel || typeof intel !== "object") {
    return null;
  }
  const profile =
    "profile" in intel && intel.profile && typeof intel.profile === "object"
      ? (intel.profile as Record<string, unknown>)
      : null;
  if (!profile) {
    return null;
  }
  const candidates = [
    profile.sellerUrl,
    profile.seller_url,
    profile.storeUrl,
    profile.store_url,
    profile.url,
    profile.sellerPageUrl,
    profile.seller_page_url,
  ];
  const url =
    candidates.find((x): x is string => typeof x === "string" && x.trim().length > 10)?.trim() ?? "";
  if (!url) {
    return null;
  }
  const low = url.toLowerCase();
  if (low.includes("trendyol.com")) {
    return "trendyol";
  }
  if (low.includes("hepsiburada.com")) {
    return "hepsiburada";
  }
  if (low.includes("n11.com")) {
    return "n11";
  }
  return null;
}
