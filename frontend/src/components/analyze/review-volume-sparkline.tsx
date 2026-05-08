"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import type { ReviewVolumePointDto } from "@/types/app-stats";

type Props = {
  points: ReviewVolumePointDto[];
  isLoading: boolean;
  /** Shown inside the empty (no points) placeholder for sighted and screen-reader users. */
  emptyLabel?: string;
  className?: string;
};

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

  return (
    <div className={cn("h-11 w-full min-w-0 text-primary", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 2, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            strokeOpacity={0.85}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
