import { cn } from "@/lib/utils";

/**
 * `NEXT_PUBLIC_APP_VERSION` + `NEXT_PUBLIC_BUILD_SHA` are set at build time in `next.config.mjs`.
 */
export function BuildVersionBadge({ className }: { className?: string }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.0.0";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA?.trim() || "";
  const label = sha ? `${version} · ${sha}` : version;

  return (
    <span
      className={cn(
        "select-none font-mono text-[11px] tabular-nums tracking-tight text-muted-foreground",
        className,
      )}
      title={`Vivindis ${label}`}
    >
      {label}
    </span>
  );
}
