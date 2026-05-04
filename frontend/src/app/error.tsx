"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { logClientErrorInDev } from "@/lib/dev-client-log";
import { cn } from "@/lib/utils";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Alt segmentlerdeki hatalar için App Router error boundary.
 * (Dev’de “missing required error components” / kısmi derleme senaryolarında da yardımcı olur.)
 */
export default function AppError({ error, reset }: Props) {
  useEffect(() => {
    logClientErrorInDev(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">Bir şeyler ters gitti</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sayfayı yeniden deneyebilir veya ana sayfaya dönebilirsiniz.
          {error.digest ? (
            <>
              {" "}
              <span className="font-mono text-xs">({error.digest})</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="default" size="sm" onClick={() => reset()}>
          Yeniden dene
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
