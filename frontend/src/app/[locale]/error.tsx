"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { logClientErrorInDev } from "@/lib/dev-client-log";
import { cn } from "@/lib/utils";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Hatalar `NextIntlClientProvider` içinde yakalanır; çeviri anahtarları kullanılır. */
export default function LocaleSegmentError({ error, reset }: Props) {
  const t = useTranslations("errors");

  useEffect(() => {
    logClientErrorInDev(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">{t("boundaryTitle")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("boundaryDescription")}
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
          {t("boundaryRetry")}
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("boundaryHome")}
        </Link>
      </div>
    </div>
  );
}
