export const queryKeys = {
  store: {
    search: (q: string, platform: string, lang: string, country: string) =>
      ["store", "search", q, platform, lang, country] as const,
  },
  apps: {
    all: ["apps"] as const,
    detail: (id: string) => ["apps", id] as const,
    fetches: (id: string) => ["apps", id, "fetches"] as const,
    fetchDetail: (appId: string, fetchId: string) => ["apps", appId, "fetches", fetchId] as const,
    reviewVolume: (appId: string, from: string, to: string) =>
      ["apps", appId, "stats", "review-volume", from, to] as const,
  },
  analyses: {
    byApp: (appId: string) => ["analyses", "app", appId] as const,
  },
  /** `GET /api/v1/fetches/{id}` — app_id path segmentine ihtiyaç yok (404 eşleşme riskini azaltır). */
  reviews: {
    fetchById: (fetchId: string) => ["reviews", "fetch", fetchId] as const,
  },
} as const;
