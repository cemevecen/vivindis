export const queryKeys = {
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
