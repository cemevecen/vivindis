/** `/api/v1/apps` yanıtları — backend `AppResponse` ile uyumlu. */

export type AppPlatform = "google_play" | "app_store" | "both";

export type FetchStatus = "waiting_approval" | "pending" | "running" | "completed" | "failed";

export type AppDto = {
  id: string;
  user_id: string;
  platform: AppPlatform;
  package_name: string;
  bundle_id: string | null;
  name: string;
  icon_url: string | null;
  developer: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Mağaza çekimi: `local` = yerel (tek dil/bölge), `global` = derin / geniş çekim. */
export type ReviewScope = "local" | "global";

export type ReviewFetchDto = {
  id: string;
  app_id: string;
  status: FetchStatus;
  from_date: string;
  to_date: string;
  review_limit?: number | null;
  review_scope: ReviewScope;
  source?: "store" | "manual_import" | "google_maps_scraper" | string;
  review_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type RecentReviewFetchDto = ReviewFetchDto & {
  app_name: string;
};

export type ReviewImportResponseDto = {
  fetch_id: string;
  review_count: number;
};

/** `GET /api/v1/apps/{id}/reviews` — yalnızca havuz doldurmak için kullanılan alanlar. */
export type ReviewListItemDto = {
  id: string;
  store_review_id: string;
  rating: number;
  body: string;
  title: string | null;
  review_date: string;
  platform: "google_play" | "app_store" | "google_maps_scraper";
  author: string | null;
};

export type ReviewListResponseDto = {
  items: ReviewListItemDto[];
  total: number;
};
