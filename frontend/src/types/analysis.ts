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
