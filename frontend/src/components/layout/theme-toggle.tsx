"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

type ThemeToggleProps = {
  className?: string;
};

const choices: { value: ThemeChoice; Icon: typeof Sun; labelKey: "themeLight" | "themeDark" | "themeSystem" }[] = [
  { value: "light", Icon: Sun, labelKey: "themeLight" },
  { value: "dark", Icon: Moon, labelKey: "themeDark" },
  { value: "system", Icon: Monitor, labelKey: "themeSystem" },
];

export function ThemeToggle({ className }: ThemeToggleProps) {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-9 shrink-0 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
          className,
        )}
        aria-hidden
      >
        {choices.map((c) => (
          <div key={c.value} className="size-8 shrink-0 rounded-md bg-muted/60" />
        ))}
      </div>
    );
  }

  const current: ThemeChoice =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return (
    <div
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-lg border border-input bg-muted/50 p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label={t("themeLabel")}
    >
      {choices.map(({ value, Icon, labelKey }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
            aria-pressed={active}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
