"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  /** Masthead vb. koyu arka plan üzerinde kontrast */
  selectClassName?: string;
  className?: string;
};

export function ThemeToggle({ selectClassName, className }: ThemeToggleProps) {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn("h-8 min-w-[7.5rem] rounded-md border border-border bg-muted/40", className)}
        aria-hidden
      />
    );
  }

  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{t("themeLabel")}</span>
      <select
        className={
          selectClassName ??
          "rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        value={theme ?? "system"}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="light">{t("themeLight")}</option>
        <option value="dark">{t("themeDark")}</option>
        <option value="system">{t("themeSystem")}</option>
      </select>
    </label>
  );
}
