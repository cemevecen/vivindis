/** `/api/v1/apps/.../analyses` ve `POST .../analyze` ile uyumlu. */

export type AnalysisStatus = "pending" | "running" | "completed" | "failed";

export type AnalysisType = "heuristic" | "ai";

export type AnalysisDto = {
  id: string;
  app_id: string;
  fetch_id: string;
  type: AnalysisType;
  status: AnalysisStatus;
  result: Record<string, unknown> | null;
  model_used: string | null;
  tokens_used: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AnalysisListDto = {
  items: AnalysisDto[];
};

export type InsightBenchmarkScore = {
  label: string;
  value: number;
  delta_vs_category: number;
  direction: "up" | "down" | "flat";
};

export type InsightBenchmark = {
  app_name: string;
  category: string;
  category_sample_apps: number;
  scores: InsightBenchmarkScore[];
};

export type InsightAlert = {
  key: string;
  title: string;
  severity: "high" | "medium" | "low";
  detail: string;
  triggered: boolean;
};

export type InsightAction = {
  problem: string;
  recommendation: string;
  owner: string;
  priority: "P0" | "P1" | "P2";
};

export type InsightReleaseImpact = {
  current_version: string | null;
  previous_version: string | null;
  current_avg_rating: number | null;
  previous_avg_rating: number | null;
  rating_delta: number | null;
  summary: string;
};

export type InsightSegment = {
  segment: string;
  reviews: number;
  avg_rating: number;
};

export type InsightsDto = {
  benchmark: InsightBenchmark;
  alerts: InsightAlert[];
  actions: InsightAction[];
  release_impact: InsightReleaseImpact;
  segments: InsightSegment[];
};
