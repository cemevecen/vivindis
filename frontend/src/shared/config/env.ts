/** Üretimde Nginx aynı origin'de `/api` proxy eder; ayrı origin için `.env` ile `VITE_API_BASE_URL`. */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}
