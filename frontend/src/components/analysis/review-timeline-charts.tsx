"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildReviewTimelineWithFlags,
  hasAnyTimelineChart,
  type ReviewTimeBucketMode,
  type ReviewTimelineRow,
} from "@/lib/review-time-buckets";
import { defaultTimelineBucket } from "@/lib/timeline-bucket-defaults";
import { cn } from "@/lib/utils";
import type { ReviewListItemDto } from "@/types/app";

const STAR_STACK_COLORS = ["var(--chart-5)", "var(--chart-4)", "var(--chart-3)", "var(--chart-2)", "var(--chart-1)"];
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
};

type Labels = {
  sectionHeading: string;
  bucketDay: string;
  bucketWeek: string;
  bucketMonth: string;
  bucketYear: string;
  volumeTitle: string;
  starsStackTitle: string;
  avgRatingTitle: string;
  empty: string;
  starShort: (n: number) => string;
  truncatedHint: string;
};

type Props = {
  reviews: ReviewListItemDto[];
  locale: string;
  labels: Labels;
  /** Tam veri yüklenmeden kısmi gösterim */
  isPartial: boolean;
  totalExpected: number;
  fetchFromDate: string;
  fetchToDate: string;
  className?: string;
};

export function ReviewTimelineCharts({
  reviews,
  locale,
  labels,
  isPartial,
  totalExpected,
  fetchFromDate,
  fetchToDate,
  className,
}: Props) {
  const rangeKey = `${fetchFromDate}\0${fetchToDate}`;
  const { defaultMode, showYear } = useMemo(
    () => defaultTimelineBucket(fetchFromDate, fetchToDate),
    [fetchFromDate, fetchToDate],
  );

  const [bucket, setBucket] = useState<ReviewTimeBucketMode>(defaultMode);

  useEffect(() => {
    setBucket(defaultMode);
  }, [rangeKey, defaultMode]);

  const { rows, flags } = useMemo(
    () => buildReviewTimelineWithFlags(reviews, bucket, locale),
    [reviews, bucket, locale],
  );

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      labelShort: r.label.length > 18 ? `${r.label.slice(0, 16)}…` : r.label,
    }));
  }, [rows]);

  const renderSparseXTick = useCallback(
    (props: { x?: number | string; y?: number | string; payload?: { value?: string }; index?: number }) => {
      const x = typeof props.x === "number" ? props.x : Number(props.x ?? 0);
      const y = typeof props.y === "number" ? props.y : Number(props.y ?? 0);
      const { payload, index = 0 } = props;
      const n = chartData.length;
      if (!payload?.value || n === 0) {
        return <g key={`tx-${index}`} />;
      }
      const last = n - 1;
      let show: boolean;
      if (n <= 14) {
        show = true;
      } else {
        const step = Math.max(1, Math.ceil((n - 1) / 11));
        show = index === 0 || index === last || index % step === 0;
      }
      if (!show) {
        return <g key={`tx-${index}`} />;
      }
      return (
        <text
          key={`tx-${index}`}
          x={x}
          y={y}
          dy={12}
          fill="currentColor"
          fontSize={10}
          textAnchor="end"
          transform={`rotate(-28,${x},${y})`}
          className="fill-muted-foreground"
        >
          {payload.value}
        </text>
      );
    },
    [chartData.length],
  );

  const bucketButtons: { id: ReviewTimeBucketMode; label: string }[] = useMemo(() => {
    const base: { id: ReviewTimeBucketMode; label: string }[] = [
      { id: "day", label: labels.bucketDay },
      { id: "week", label: labels.bucketWeek },
      { id: "month", label: labels.bucketMonth },
    ];
    if (showYear) {
      base.push({ id: "year", label: labels.bucketYear });
    }
    return base;
  }, [labels.bucketDay, labels.bucketMonth, labels.bucketWeek, labels.bucketYear, showYear]);

  if (reviews.length === 0 || !hasAnyTimelineChart(flags)) {
    return null;
  }

  const showBucketToolbar = flags.showVolume || flags.showAvgRating;

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{labels.sectionHeading}</h2>
        {showBucketToolbar ? (
          <div
            className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label={labels.sectionHeading}
          >
            {bucketButtons.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  bucket === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setBucket(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isPartial && totalExpected > reviews.length ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{labels.truncatedHint}</p>
      ) : null}

      {flags.showVolume ? (
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.volumeTitle}</h3>
          <div className="h-[300px] w-full min-w-0">
            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="labelShort" interval={0} tick={renderSparseXTick} height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    cursor={false}
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => (payload[0]?.payload as ReviewTimelineRow | undefined)?.label ?? ""}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name={labels.volumeTitle} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      ) : null}

      {flags.showStarsStack ? (
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.starsStackTitle}</h3>
          <div className="h-[320px] w-full min-w-0">
            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="labelShort" interval={0} tick={renderSparseXTick} height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    cursor={false}
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => (payload[0]?.payload as ReviewTimelineRow | undefined)?.label ?? ""}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Bar
                      key={n}
                      dataKey={`r${n}` as keyof ReviewTimelineRow}
                      stackId="stars"
                      fill={STAR_STACK_COLORS[n - 1]}
                      name={labels.starShort(n)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      ) : null}

      {flags.showAvgRating ? (
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.avgRatingTitle}</h3>
          <div className="h-[280px] w-full min-w-0">
            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="labelShort" interval={0} tick={renderSparseXTick} height={70} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip
                    cursor={false}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [
                      typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—",
                      labels.avgRatingTitle,
                    ]}
                    labelFormatter={(_, payload) => (payload[0]?.payload as ReviewTimelineRow | undefined)?.label ?? ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRating"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
