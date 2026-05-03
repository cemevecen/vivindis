export type StoreSearchHit = {
  store: "google_play" | "app_store";
  package_name: string;
  bundle_id: string | null;
  name: string;
  icon_url: string | null;
  developer: string | null;
  category: string | null;
  score: number | null;
};
