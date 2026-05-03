export const queryKeys = {
  store: {
    search: (q: string, platform: string) => ["store", "search", q, platform] as const,
  },
  apps: {
    all: ["apps"] as const,
    detail: (id: string) => ["apps", id] as const,
    fetches: (id: string) => ["apps", id, "fetches"] as const,
    fetchDetail: (appId: string, fetchId: string) => ["apps", appId, "fetches", fetchId] as const,
  },
  analyses: {
    byApp: (appId: string) => ["analyses", "app", appId] as const,
  },
} as const;
