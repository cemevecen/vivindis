/**
 * Üretimde konsol kirliliği yok; yalnızca development’ta hata ayıklama.
 */
export function logClientErrorInDev(error: unknown): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- kasıtlı: yerel hata ayıklama
    console.error(error);
  }
}
