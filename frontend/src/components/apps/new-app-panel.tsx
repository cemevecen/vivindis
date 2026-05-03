"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { NewAppForm } from "@/components/apps/new-app-form";

type Props = {
  clerkEnabled: boolean;
};

export function NewAppPanel({ clerkEnabled }: Props) {
  const tDash = useTranslations("dashboard");

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {tDash("noClerk")}
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <NewAppForm />
    </Suspense>
  );
}
