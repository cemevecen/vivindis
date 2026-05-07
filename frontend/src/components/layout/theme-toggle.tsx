"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

const itemClassName = cn(
  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
);

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
        className={cn("h-9 w-[4.25rem] shrink-0 rounded-md border border-border bg-muted/40", className)}
        aria-hidden
      />
    );
  }

  const current = theme ?? "system";
  const TriggerIcon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;

  return (
    <div className={cn(className)}>
      <Menu.Root>
        <Menu.Trigger
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-foreground shadow-sm outline-none transition-colors",
            "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={t("themeLabel")}
        >
          <TriggerIcon className="size-4" aria-hidden />
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="outline-none" sideOffset={8} align="end">
            <Menu.Popup
              className={cn(
                "z-50 min-w-[9rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
              )}
            >
              <Menu.RadioGroup
                value={current}
                onValueChange={(value) => {
                  setTheme(String(value));
                }}
              >
                <Menu.RadioItem
                  value="light"
                  className={itemClassName}
                  closeOnClick
                  label={t("themeLight")}
                >
                  <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center" keepMounted>
                    <Check className="size-3.5" aria-hidden />
                  </Menu.RadioItemIndicator>
                  <Sun className="size-4 shrink-0" aria-hidden />
                  <span className="sr-only">{t("themeLight")}</span>
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="dark"
                  className={itemClassName}
                  closeOnClick
                  label={t("themeDark")}
                >
                  <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center" keepMounted>
                    <Check className="size-3.5" aria-hidden />
                  </Menu.RadioItemIndicator>
                  <Moon className="size-4 shrink-0" aria-hidden />
                  <span className="sr-only">{t("themeDark")}</span>
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="system"
                  className={itemClassName}
                  closeOnClick
                  label={t("themeSystem")}
                >
                  <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center" keepMounted>
                    <Check className="size-3.5" aria-hidden />
                  </Menu.RadioItemIndicator>
                  <Monitor className="size-4 shrink-0" aria-hidden />
                  <span className="sr-only">{t("themeSystem")}</span>
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
