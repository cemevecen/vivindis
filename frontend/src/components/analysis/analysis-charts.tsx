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
import type { AnalysisDto } from "@/types/analysis";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(142, 71%, 36%)",
  neutral: "hsl(220, 9%, 46%)",
  negative: "hsl(0, 72%, 51%)",
};

type BlockProps = {
  title: string;
  analysis: AnalysisDto | undefined;
  labels: {
    sentiment: string;
    ratings: string;
    topics: string;
    overall: string;
    empty: string;
    failed: string;
  };
};

function ChartBlock({ title, analysis, labels }: BlockProps) {
  if (!analysis) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
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
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
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

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {score !== null ? (
          <p className="text-xs text-muted-foreground">
            {labels.overall}: <span className="font-mono font-medium text-foreground">{score.toFixed(1)}</span>
            {analysis.model_used ? (
              <span className="ml-2 text-muted-foreground">({analysis.model_used})</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-h-[220px]">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.sentiment}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie dataKey="value" data={sentiment} nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                {sentiment.map((entry) => (
                  <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "hsl(var(--muted-foreground))"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="min-h-[220px] lg:col-span-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.ratings}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ratings}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="min-h-[220px] lg:col-span-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{labels.topics}</p>
          {topics.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topics} layout="vertical" margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="topic"
                  width={72}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)}
                />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(217, 91%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">—</p>
          )}
        </div>
      </div>
    </section>
  );
}

type Props = {
  heuristic?: AnalysisDto;
  ai?: AnalysisDto;
  chartLabels: BlockProps["labels"] & { heuristicTitle: string; aiTitle: string };
};

export function AnalysisCharts({ heuristic, ai, chartLabels }: Props) {
  const { heuristicTitle, aiTitle, ...labels } = chartLabels;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartBlock title={heuristicTitle} analysis={heuristic} labels={labels} />
      <ChartBlock title={aiTitle} analysis={ai} labels={labels} />
    </div>
  );
}
