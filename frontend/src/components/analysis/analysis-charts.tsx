"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  overallScoreFromResult,
  ratingsFromResult,
  sentimentFromResult,
  topicsFromResult,
} from "@/lib/analysis-result";
import { cn } from "@/lib/utils";
import type { AnalysisDto } from "@/types/analysis";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(142, 71%, 36%)",
  neutral: "hsl(220, 9%, 46%)",
  negative: "hsl(0, 72%, 51%)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
};

type ChartLabels = {
  sentiment: string;
  ratings: string;
  topics: string;
  overall: string;
  empty: string;
  failed: string;
};

type BlockProps = {
  title: string;
  analysis: AnalysisDto | undefined;
  labels: ChartLabels;
  /** Dar sütun (karşılaştırma): tek kart içinde 3’lü ızgara. */
  compact?: boolean;
  /** Analiz sayfası: her grafik ayrı geniş kart. */
  featured?: boolean;
};

function SentimentCard({
  sentiment,
  labels,
  chartH,
  pieR,
  featured,
}: {
  sentiment: ReturnType<typeof sentimentFromResult>;
  labels: ChartLabels;
  chartH: number;
  pieR: number;
  featured: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        featured ? "p-5 md:p-6" : "min-h-0 p-4",
      )}
    >
      <h4 className={cn("font-semibold text-foreground", featured ? "mb-4 text-sm md:text-base" : "mb-2 text-xs")}>
        {labels.sentiment}
      </h4>
      <div className={cn(featured ? "h-[300px]" : "")} style={featured ? undefined : { minHeight: chartH }}>
        <ResponsiveContainer width="100%" height={featured ? "100%" : chartH}>
          <PieChart margin={{ top: featured ? 8 : 4, right: 8, left: 8, bottom: featured ? 8 : 0 }}>
            <Pie
              dataKey="value"
              data={sentiment}
              nameKey="name"
              cx="50%"
              cy={featured ? "50%" : "43%"}
              outerRadius={featured ? 88 : pieR}
            >
              {sentiment.map((entry) => (
                <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "hsl(var(--muted-foreground))"} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: featured ? 12 : 11, paddingTop: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function RatingsDistCard({
  ratings,
  labels,
  chartH,
  featured,
}: {
  ratings: ReturnType<typeof ratingsFromResult>;
  labels: ChartLabels;
  chartH: number;
  featured: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        featured ? "p-5 md:p-6" : "min-h-0 p-4",
      )}
    >
      <h4 className={cn("font-semibold text-foreground", featured ? "mb-4 text-sm md:text-base" : "mb-2 text-xs")}>
        {labels.ratings}
      </h4>
      <div className={cn(featured ? "h-[280px]" : "")} style={featured ? undefined : { minHeight: chartH }}>
        <ResponsiveContainer width="100%" height={featured ? "100%" : chartH}>
          <BarChart data={ratings} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="rating" tick={{ fontSize: featured ? 12 : 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: featured ? 12 : 11 }} width={featured ? 40 : 32} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function TopicsCard({
  topics,
  labels,
  chartH,
  featured,
}: {
  topics: ReturnType<typeof topicsFromResult>;
  labels: ChartLabels;
  chartH: number;
  featured: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        featured ? "p-5 md:p-6" : "min-h-0 p-4",
      )}
    >
      <h4 className={cn("font-semibold text-foreground", featured ? "mb-4 text-sm md:text-base" : "mb-2 text-xs")}>
        {labels.topics}
      </h4>
      <div className={cn(featured ? "h-[320px]" : "")} style={featured ? undefined : { minHeight: chartH }}>
        {topics.length > 0 ? (
          <ResponsiveContainer width="100%" height={featured ? "100%" : chartH}>
            <BarChart data={topics} layout="vertical" margin={{ top: 8, left: featured ? 8 : 2, right: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: featured ? 12 : 11 }} />
              <YAxis
                type="category"
                dataKey="topic"
                width={featured ? 100 : 72}
                tick={{ fontSize: featured ? 11 : 10 }}
                tickFormatter={(v: string) => (v.length > (featured ? 22 : 14) ? `${v.slice(0, featured ? 20 : 14)}…` : v)}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground md:py-16">—</p>
        )}
      </div>
    </article>
  );
}

function ChartBlock({ title, analysis, labels, compact = false, featured = false }: BlockProps) {
  if (!analysis) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-destructive">{labels.failed}</p>
        {analysis.error_message ? (
          <p className="mt-1 text-xs text-muted-foreground">{analysis.error_message}</p>
        ) : null}
      </section>
    );
  }

  if (analysis.status !== "completed" || !analysis.result) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </section>
    );
  }

  const result = analysis.result;
  const sentiment = sentimentFromResult(result);
  const ratings = ratingsFromResult(result);
  const topics = topicsFromResult(result, 8);
  const score = overallScoreFromResult(result);
  const chartH = compact ? 200 : 200;
  const pieR = compact ? 44 : 70;
  const useFeatured = featured && !compact;

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
      <h3 className={cn("font-semibold text-foreground", useFeatured ? "text-base md:text-lg" : "text-sm")}>{title}</h3>
      {score !== null ? (
        <p className="text-xs text-muted-foreground md:text-sm">
          {labels.overall}: <span className="font-mono font-medium text-foreground">{score.toFixed(1)}</span>
          {analysis.model_used ? (
            <span className="ml-2 text-muted-foreground">({analysis.model_used})</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );

  if (useFeatured) {
    return (
      <div className="space-y-5">
        {header}
        <SentimentCard sentiment={sentiment} labels={labels} chartH={chartH} pieR={pieR} featured />
        <RatingsDistCard ratings={ratings} labels={labels} chartH={chartH} featured />
        <TopicsCard topics={topics} labels={labels} chartH={chartH} featured />
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/50 p-4 shadow-sm md:p-5">
      {header}
      <div className={compact ? "grid grid-cols-1 gap-4" : "grid gap-6 lg:grid-cols-3"}>
        <div className={compact ? "min-h-[220px]" : "min-h-[220px]"}>
          <SentimentCard sentiment={sentiment} labels={labels} chartH={chartH} pieR={pieR} featured={false} />
        </div>
        <div className={compact ? "min-h-[220px]" : "min-h-[220px] lg:col-span-1"}>
          <RatingsDistCard ratings={ratings} labels={labels} chartH={chartH} featured={false} />
        </div>
        <div className={compact ? "min-h-[220px]" : "min-h-[220px] lg:col-span-1"}>
          <TopicsCard topics={topics} labels={labels} chartH={chartH} featured={false} />
        </div>
      </div>
    </section>
  );
}

type Props = {
  heuristic?: AnalysisDto;
  ai?: AnalysisDto;
  chartLabels: ChartLabels & { heuristicTitle: string; aiTitle: string };
  splitPane?: boolean;
  /** Analiz sayfasında grafikleri ayrı geniş kartlara böl. */
  chartLayout?: "compact" | "featured";
};

export function AnalysisCharts({ heuristic, ai, chartLabels, splitPane = false, chartLayout = "compact" }: Props) {
  const { heuristicTitle, aiTitle, ...labels } = chartLabels;
  const featured = chartLayout === "featured" && !splitPane;
  return (
    <div className={splitPane ? "grid grid-cols-1 gap-4" : "grid gap-8 lg:grid-cols-2"}>
      <ChartBlock
        title={heuristicTitle}
        analysis={heuristic}
        labels={labels}
        compact={splitPane}
        featured={featured}
      />
      <ChartBlock title={aiTitle} analysis={ai} labels={labels} compact={splitPane} featured={featured} />
    </div>
  );
}
