import type { AppDto } from "@/types/app";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Mağaza tarafındaki kimlik: aynı paket / bundle ile oluşturulmuş birden fazla `AppDto`
 * kaydını liste görünümünde bir kartta birleştirmek için kullanılır.
 */
export function appStoreIdentityKey(app: AppDto): string {
  const pkg = norm(app.package_name || "");
  const bundle = norm(app.bundle_id || "");
  switch (app.platform) {
    case "google_play":
      return pkg.length > 0 ? `gp:${pkg}` : `id:${app.id}`;
    case "app_store":
      if (bundle.length > 0) {
        return `as:${bundle}`;
      }
      return pkg.length > 0 ? `as:pkg:${pkg}` : `id:${app.id}`;
    case "both":
      if (pkg.length > 0 && bundle.length > 0) {
        return `both:${pkg}|${bundle}`;
      }
      if (pkg.length > 0) {
        return `both:gp:${pkg}`;
      }
      if (bundle.length > 0) {
        return `both:as:${bundle}`;
      }
      return `id:${app.id}`;
    default:
      return `id:${app.id}`;
  }
}

function pickCanonicalApp(group: AppDto[], preferAppId?: string | null): AppDto {
  if (preferAppId) {
    const preferred = group.find((a) => a.id === preferAppId);
    if (preferred) {
      return preferred;
    }
  }
  const sorted = [...group].sort((a, b) => {
    const u = b.updated_at.localeCompare(a.updated_at);
    if (u !== 0) {
      return u;
    }
    return b.created_at.localeCompare(a.created_at);
  });
  return sorted[0]!;
}

/**
 * Liste / seçicilerde tek satır: aynı mağaza kimliği için tek `AppDto`.
 * `preferAppId` (ör. oturumda sabitlenen uygulama) grupta varsa o kayıt seçilir.
 */
export function dedupeAppsForList(apps: AppDto[], options?: { preferAppId?: string | null }): AppDto[] {
  const byKey = new Map<string, AppDto[]>();
  for (const app of apps) {
    const key = appStoreIdentityKey(app);
    const arr = byKey.get(key) ?? [];
    arr.push(app);
    byKey.set(key, arr);
  }
  const out: AppDto[] = [];
  for (const group of Array.from(byKey.values())) {
    out.push(pickCanonicalApp(group, options?.preferAppId));
  }
  return out.sort((a, b) => {
    const n = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    if (n !== 0) {
      return n;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Aynı mağaza kimliğine sahip diğer kayıtlar (mevcut kayıt hariç). */
export function findDuplicateAppsForApp(allApps: AppDto[], app: AppDto): AppDto[] {
  const key = appStoreIdentityKey(app);
  return allApps
    .filter((a) => a.id !== app.id && appStoreIdentityKey(a) === key)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
