"use client";

import "./globals.css";

import { useEffect } from "react";

import { logClientErrorInDev } from "@/lib/dev-client-log";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Kök `layout` içindeki hatalar için tam sayfa fallback (`<html>` / `<body>` gerekir).
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    logClientErrorInDev(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background p-8 font-sans text-foreground antialiased">
        <h1 className="text-lg font-semibold tracking-tight">Critical error</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The interface could not load. In development, stop all next dev processes, run rm -rf .next, then
          restart.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
