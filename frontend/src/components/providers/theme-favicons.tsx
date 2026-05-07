"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const ICON_32_LIGHT = "/icons/icon-32-light.png";
const ICON_32_DARK = "/icons/icon-32-dark.png";
const ICON_16_LIGHT = "/icons/icon-16-light.png";
const ICON_16_DARK = "/icons/icon-16-dark.png";
const APPLE_180_LIGHT = "/icons/icon-180-light.png";
const APPLE_180_DARK = "/icons/icon-180-dark.png";

/**
 * next-intl head uses light assets as SSR default; this aligns tab / PWA chrome
 * icons with next-themes (site light/dark/system), not only OS prefers-color-scheme.
 */
export function ThemeFavicons() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
      return;
    }
    const dark = resolvedTheme === "dark";
    const icon32 = dark ? ICON_32_DARK : ICON_32_LIGHT;
    const icon16 = dark ? ICON_16_DARK : ICON_16_LIGHT;
    const apple = dark ? APPLE_180_DARK : APPLE_180_LIGHT;

    document.querySelectorAll('link[rel="icon"]').forEach((node) => {
      const link = node as HTMLLinkElement;
      const type = link.getAttribute("type");
      if (type && type !== "image/png") {
        return;
      }
      const sizes = link.getAttribute("sizes");
      if (sizes === "32x32") {
        link.href = icon32;
      }
      if (sizes === "16x16") {
        link.href = icon16;
      }
    });

    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((node) => {
      const link = node as HTMLLinkElement;
      const href = link.getAttribute("href") ?? "";
      if (href.includes("/icons/icon-180-")) {
        link.href = apple;
      }
    });
  }, [resolvedTheme]);

  return null;
}
