import { getApiBaseUrl } from "@/shared/config/env";

export function apiHeaders(lang: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-App-Lang": lang,
  };
}

/** Mutlak veya `/api/...` yolu; geliştirmede Vite proxy kullanılır. */
export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiUrl(path), init);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${r.status} ${t.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}
