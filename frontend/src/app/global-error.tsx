"use client";

import "./globals.css";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Kök `layout` içindeki hatalar için tam sayfa fallback (`<html>` / `<body>` gerekir).
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- yalnızca geliştirici hata ayıklama
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-background p-8 font-sans text-foreground antialiased">
        <h1 className="text-lg font-semibold tracking-tight">Kritik hata</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Arayüz yüklenemedi. Geliştirme ortamında tüm `next dev` süreçlerini kapatıp `rm -rf .next` sonrası
          yeniden başlatmayı deneyin.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          onClick={() => reset()}
        >
          Yeniden dene
        </button>
      </body>
    </html>
  );
}
