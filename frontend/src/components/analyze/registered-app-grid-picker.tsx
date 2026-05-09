"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";
import type { AppPlatform } from "@/types/app";

function platformBadgeClass(platform: AppPlatform): string {
  switch (platform) {
    case "google_play":
      return "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100";
    case "app_store":
      return "bg-sky-600/15 text-sky-950 dark:text-sky-100";
    default:
      return "bg-violet-600/15 text-violet-950 dark:text-violet-100";
  }
}

export function RegisteredAppTileVisual({
  app,
  platformLabel,
  iconClassName = "size-10 rounded-xl",
}: {
  app: AppDto;
  platformLabel: string;
  iconClassName?: string;
}) {
  return (
    <>
      {app.icon_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- store icon URL
        <img
          src={app.icon_url}
          alt=""
          width={40}
          height={40}
          className={cn("shrink-0 border border-border object-cover", iconClassName)}
        />
      ) : (
        <div className={cn("shrink-0 border border-dashed border-border bg-muted/50", iconClassName)} />
      )}
      <span
        className={cn(
          "max-w-full truncate rounded px-1 py-0.5 text-center text-[10px] font-semibold leading-none",
          platformBadgeClass(app.platform),
        )}
      >
        {platformLabel}
      </span>
      <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-foreground">
        {app.name}
      </span>
    </>
  );
}

type RegisteredAppGridPickerProps = {
  id: string;
  apps: AppDto[];
  value: AppDto | null;
  onChange: (app: AppDto | null) => void;
  disabled?: boolean;
  placeholder: string;
  clearLabel: string;
  getPlatformLabel: (platform: AppPlatform) => string;
  className?: string;
  /** Üst bileşen mağaza araması bittiğinde artırır; açık açılır liste kapanır. */
  collapseNonce?: number;
};

export function RegisteredAppGridPicker({
  id,
  apps,
  value,
  onChange,
  disabled = false,
  placeholder,
  clearLabel,
  getPlatformLabel,
  className,
  collapseNonce,
}: RegisteredAppGridPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const prevCollapseNonce = useRef(0);

  useEffect(() => {
    if (collapseNonce === undefined) {
      return;
    }
    if (collapseNonce > prevCollapseNonce.current) {
      setOpen(false);
      prevCollapseNonce.current = collapseNonce;
    }
  }, [collapseNonce]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [open]);

  const showPanel = open && !disabled && apps.length > 0;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={showPanel}
        aria-controls={listId}
        className={cn(
          "flex w-full min-h-11 items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm outline-none transition-colors",
          "hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o);
          }
        }}
      >
        {value ? (
          <>
            {value.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value.icon_url}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="size-7 shrink-0 rounded-lg border border-dashed border-border bg-muted/50" />
            )}
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                platformBadgeClass(value.platform),
              )}
            >
              {getPlatformLabel(value.platform)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{value.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 opacity-70 transition-transform", showPanel && "rotate-180")} aria-hidden />
      </button>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {value ? (
            <div className="mb-2 flex justify-center border-b border-border pb-2">
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {clearLabel}
              </button>
            </div>
          ) : null}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))" }}
          >
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                role="option"
                aria-selected={value?.id === app.id}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border border-transparent p-2 text-center outline-none transition-colors",
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  value?.id === app.id && "border-primary/50 bg-primary/5",
                )}
                onClick={() => {
                  onChange(app);
                  setOpen(false);
                }}
              >
                <RegisteredAppTileVisual app={app} platformLabel={getPlatformLabel(app.platform)} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
