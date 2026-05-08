"use client";

import { useMemo, useState } from "react";
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

import { buildReviewTimeline, type ReviewTimeBucketMode, type ReviewTimelineRow } from "@/lib/review-time-buckets";
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
  className?: string;
};

export function ReviewTimelineCharts({ reviews, locale, labels, isPartial, totalExpected, className }: Props) {
  const [bucket, setBucket] = useState<ReviewTimeBucketMode>("week");

  const rows = useMemo(() => buildReviewTimeline(reviews, bucket, locale), [reviews, bucket, locale]);

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      labelShort: r.label.length > 18 ? `${r.label.slice(0, 16)}…` : r.label,
    }));
  }, [rows]);

  const bucketButtons: { id: ReviewTimeBucketMode; label: string }[] = [
    { id: "day", label: labels.bucketDay },
    { id: "week", label: labels.bucketWeek },
    { id: "month", label: labels.bucketMonth },
  ];

  if (reviews.length === 0) {
    return (
      <section className={cn("rounded-2xl border border-border bg-card p-6 shadow-sm", className)}>
        <h2 className="text-base font-semibold text-foreground">{labels.sectionHeading}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{labels.sectionHeading}</h2>
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
      </div>

      {isPartial && totalExpected > reviews.length ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{labels.truncatedHint}</p>
      ) : null}

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.volumeTitle}</h3>
        <div className="h-[300px] w-full min-w-0">
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="labelShort" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, payload) => (payload[0]?.payload as ReviewTimelineRow | undefined)?.label ?? ""}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name={labels.volumeTitle} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.starsStackTitle}</h3>
        <div className="h-[320px] w-full min-w-0">
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="labelShort" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip
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

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{labels.avgRatingTitle}</h3>
        <div className="h-[280px] w-full min-w-0">
          {chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="labelShort" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={70} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={32} />
                <Tooltip
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
    </section>
  );
}
