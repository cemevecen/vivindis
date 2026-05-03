import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const backendOrigin = process.env.BACKEND_ORIGIN?.trim();
const explicitPublicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
/** İstemci göreli `/api/v1` kullansın (NEXT_PUBLIC_API_URL yoksa). Proxy: build-time rewrite veya `app/api/v1/[...path]/route.ts` (runtime BACKEND_ORIGIN). */
const useClientRelativeApi = !explicitPublicApi;
const useBuildTimeRewrite = Boolean(backendOrigin && useClientRelativeApi);

function shortBuildSha() {
  const fromCi =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CF_PAGES_COMMIT_SHA;
  if (typeof fromCi === "string" && fromCi.length >= 7) {
    return fromCi.slice(0, 7);
  }
  try {
    const repoRoot = join(__dirname, "..");
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "local";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? "0.0.0",
    NEXT_PUBLIC_BUILD_SHA: shortBuildSha(),
    ...(useClientRelativeApi ? { NEXT_PUBLIC_USE_API_REWRITE: "1" } : {}),
  },
  async rewrites() {
    if (!useBuildTimeRewrite || !backendOrigin) {
      return [];
    }
    const origin = backendOrigin.replace(/\/$/, "").replace(/\/api\/v1$/i, "");
    return [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
