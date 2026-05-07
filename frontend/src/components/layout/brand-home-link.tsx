import Image from "next/image";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  /** e.g. `text-lg font-semibold tracking-tight` for header */
  wordmarkClassName?: string;
  /** Header uses `md` (40px), compact uses `sm` (36px). */
  iconSize?: "sm" | "md";
  className?: string;
};

/**
 * Home link: themed squircle + Vivindis wordmark (light/dark PNGs via `html.dark`).
 */
export function BrandHomeLink({ wordmarkClassName, iconSize = "md", className }: Props) {
  const iconPx = iconSize === "sm" ? 36 : 40;
  const sizeCls = iconSize === "sm" ? "size-9" : "size-10";

  return (
    <Link
      href="/"
      className={cn("flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90", className)}
    >
      <span className={cn("relative shrink-0", sizeCls)} aria-hidden>
        <Image
          src="/icons/icon-48-light.png"
          alt=""
          width={iconPx}
          height={iconPx}
          className={cn(sizeCls, "rounded-lg object-cover dark:hidden")}
          sizes={`${iconPx}px`}
        />
        <Image
          src="/icons/icon-48-dark.png"
          alt=""
          width={iconPx}
          height={iconPx}
          className={cn("hidden rounded-lg object-cover dark:block", sizeCls)}
          sizes={`${iconPx}px`}
        />
      </span>
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground",
          wordmarkClassName ?? "text-base",
        )}
      >
        Vivindis
      </span>
    </Link>
  );
}
