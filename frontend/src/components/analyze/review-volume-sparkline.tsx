"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { ReviewVolumePointDto } from "@/types/app-stats";

/** ViewBox width; height matches Tailwind h-11 (44px). */
const VB_W = 320;
const VB_H = 44;
const PAD_Y = 6;

type Props = {
  points: ReviewVolumePointDto[];
  isLoading: boolean;
  /** Shown inside the empty (no points) placeholder for sighted and screen-reader users. */
  emptyLabel?: string;
  className?: string;
};

function buildSparklinePath(counts: number[]): string {
  const n = counts.length;
  if (n === 0) {
    return "";
  }
  const maxVal = Math.max(...counts, 1);
  const innerH = VB_H - PAD_Y * 2;
  const yAt = (c: number) => PAD_Y + innerH * (1 - c / maxVal);

  if (n === 1) {
    const only = counts[0] ?? 0;
    const y = yAt(only);
    return `M 0 ${y} L ${VB_W} ${y}`;
  }

  const step = VB_W / (n - 1);
  return counts
    .map((c, i) => {
      const x = i * step;
      const y = yAt(c);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function ReviewVolumeSparkline({ points, isLoading, emptyLabel, className }: Props) {
  const data = useMemo(
    () => points.map((p) => ({ date: p.date, count: p.count })),
    [points],
  );

  if (isLoading && data.length === 0) {
    return <div className={cn("h-11 w-full rounded-lg bg-muted/40 animate-pulse", className)} />;
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-11 w-full items-center justify-center rounded-lg border border-dashed border-border/60 px-2 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        {emptyLabel ?? null}
      </div>
    );
  }

  const counts = data.map((d) => d.count);
  const pathD = buildSparklinePath(counts);
  const hasVolume = counts.some((c) => c > 0);

  return (
    <div
      className={cn(
        "h-11 w-full min-w-0 rounded-lg text-primary outline-none focus:outline-none [&_svg]:outline-none",
        hasVolume ? "text-primary" : "text-muted-foreground/70",
        className,
      )}
    >
      {!hasVolume && emptyLabel ? (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <svg
          className="block h-full w-full"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          {pathD ? (
            <path
              d={pathD}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeOpacity={hasVolume ? 0.9 : 0.45}
            />
          ) : null}
        </svg>
      )}
    </div>
  );
}
