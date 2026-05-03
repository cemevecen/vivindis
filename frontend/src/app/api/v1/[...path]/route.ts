import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function backendBase(): string | null {
  const raw = process.env.BACKEND_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "").replace(/\/api\/v1$/i, "");
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { detail: "BACKEND_ORIGIN tanımlı değil (Vercel → Environment Variables)." },
      { status: 503 },
    );
  }

  const suffix = pathSegments.length ? pathSegments.join("/") : "";
  const target = new URL(`${base}/api/v1/${suffix}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: request.signal,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  const upstream = await fetch(target.toString(), init);

  const outHeaders = new Headers(upstream.headers);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

type RouteCtx = { params: { path: string[] } };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}

export async function OPTIONS(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, ctx.params.path ?? []);
}
