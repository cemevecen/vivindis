/**
 * Tüm backend çağrıları bu modülden yapılacak (Oturum 3+).
 * Base URL: `NEXT_PUBLIC_API_URL` (köksüz; sonunda `/api/v1` **yok** — path zaten `/api/v1/...`).
 * `NEXT_PUBLIC_USE_API_REWRITE=1` ise taban boş kalır; `next.config` içindeki rewrite aynı origin’den API’ye proxylanır.
 */

const API_V1_PREFIX = "/api/v1";

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw;
  if (process.env.NEXT_PUBLIC_USE_API_REWRITE === "1") return "";
  return "";
};

/** İstemcinin API’ye gidebileceği bir yapılandırma var mı (doğrudan URL veya Next rewrite). */
export function isPublicApiBaseUrlConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_USE_API_REWRITE === "1") return true;
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}

function detailToMessage(parsed: unknown, statusText: string): string {
  if (typeof parsed !== "object" || parsed === null) {
    return statusText;
  }
  const o = parsed as Record<string, unknown>;
  const detail = o.detail;
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const row = item as Record<string, unknown>;
          if (typeof row.msg === "string") return row.msg;
          if (typeof row.message === "string") return row.message;
        }
        return null;
      })
      .filter((x): x is string => Boolean(x));
    if (parts.length > 0) return parts.join(" ");
  }
  if (typeof o.message === "string" && o.message.length > 0) {
    return o.message;
  }
  return statusText;
}

function errorBodyToMessage(parsed: unknown, status: number, statusText: string): string {
  if (typeof parsed === "string") {
    const s = parsed.trim();
    if (s.startsWith("<!DOCTYPE") || s.toLowerCase().startsWith("<html")) {
      return `HTTP ${status}: Response was HTML (often a missing route or wrong host). Check NEXT_PUBLIC_API_URL.`;
    }
    if (s.length > 400) return `${s.slice(0, 400)}…`;
    return s.length > 0 ? s : statusText;
  }
  return detailToMessage(parsed, statusText);
}

/** Human-readable message for thrown `ApiError` or network failures. */
export function formatClientFetchError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ApiErrorBody = { detail?: string; message?: string };

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type ApiFetchInit = Omit<RequestInit, "body"> & {
  body?: Json;
  /** Clerk `getToken()` vb. — varsa `Authorization: Bearer` eklenir. */
  getToken?: () => Promise<string | null>;
};

/** Ardışık `/api/v1/api/v1` parçalarını tek `/api/v1` yapar (env + path hataları). */
function dedupeApiV1Segments(url: string): string {
  const dup = "/api/v1/api/v1";
  let u = url;
  while (u.includes(dup)) {
    u = u.replace(dup, "/api/v1");
  }
  return u;
}

function buildUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "");
  let p = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return dedupeApiV1Segments(p);
  }
  // Yaygın hata: NEXT_PUBLIC_API_URL=https://api…/api/v1 iken path de /api/v1/... → 404
  if (p.startsWith(API_V1_PREFIX) && /\/api\/v1$/i.test(base)) {
    p = p.slice(API_V1_PREFIX.length);
    if (!p.startsWith("/")) {
      p = `/${p}`;
    }
  }
  return dedupeApiV1Segments(`${base}${p}`);
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { getToken, body, ...restInit } = init ?? {};
  const headers = new Headers(restInit.headers);
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  if (!headers.has("Content-Type") && body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const url = buildUrl(path);
  const res = await fetch(url, {
    ...restInit,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    let msg = errorBodyToMessage(parsed, res.status, res.statusText);
    if (res.status === 404 && msg === "Not Found") {
      const hint =
        "NEXT_PUBLIC_API_URL yalnızca kök olmalı (örn. https://api…), sonuna /api/v1 eklemeyin. " +
        "Aynı site proxy: Vercel’de BACKEND_ORIGIN + boş NEXT_PUBLIC_API_URL (README). " +
        "Yol doğruysa Railway’de backend’i güncel kodla yeniden deploy edin.";
      const shown = url.length > 280 ? `${url.slice(0, 280)}…` : url;
      msg = `${msg} — ${hint} İstek: ${shown}`;
    }
    throw new ApiError(msg, res.status, parsed);
  }

  return parsed as T;
}
