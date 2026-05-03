export type StoreSearchPlatform = "google_play" | "app_store";

export type StoreSearchResultItem = {
  id: string;
  name: string;
  developer: string | null;
  icon: string | null;
  rating: number | null;
  reviews: number | null;
  platform: StoreSearchPlatform;
};

export type StoreSearchResponse = {
  results: StoreSearchResultItem[];
};
