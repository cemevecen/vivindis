/**
 * Tüm backend çağrıları bu modülden yapılacak (Oturum 3+).
 * Base URL: `NEXT_PUBLIC_API_URL` (boşsa aynı origin; Docker Compose’ta genelde http://localhost:8001).
 */

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  return raw ?? "";
};

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

function buildUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return p;
  }
  return `${base}${p}`;
}

export async function apiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: Json },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(buildUrl(path), {
    ...init,
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
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
    const msg =
      typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? String((parsed as ApiErrorBody).detail ?? res.statusText)
        : res.statusText;
    throw new ApiError(msg, res.status, parsed);
  }

  return parsed as T;
}
