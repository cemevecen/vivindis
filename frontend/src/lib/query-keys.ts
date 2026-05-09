export const queryKeys = {
  store: {
    search: (q: string, platform: string, lang: string, country: string, offset = 0, num = 20) =>
      ["store", "search", q, platform, lang, country, offset, num] as const,
  },
  apps: {
    all: ["apps"] as const,
    recentFetches: ["apps", "recent-fetches"] as const,
    detail: (id: string) => ["apps", id] as const,
    fetches: (id: string) => ["apps", id, "fetches"] as const,
    fetchDetail: (appId: string, fetchId: string) => ["apps", appId, "fetches", fetchId] as const,
  },
  analyses: {
    byApp: (appId: string) => ["analyses", "app", appId] as const,
  },
  /** `GET /api/v1/fetches/{id}` — app_id path segmentine ihtiyaç yok (404 eşleşme riskini azaltır). */
  reviews: {
    fetchById: (fetchId: string) => ["reviews", "fetch", fetchId] as const,
  },
} as const;
