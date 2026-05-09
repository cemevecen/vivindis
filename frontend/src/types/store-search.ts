export type StoreSearchPlatform = "google_play" | "app_store";

export type StoreSearchResultItem = {
  id: string;
  name: string;
  developer: string | null;
  icon: string | null;
  rating: number | null;
  review_count: number | null;
  platform: StoreSearchPlatform;
  store_url: string | null;
};

export type StoreSearchResponse = {
  results: StoreSearchResultItem[];
  has_more?: boolean;
  offset?: number;
};
