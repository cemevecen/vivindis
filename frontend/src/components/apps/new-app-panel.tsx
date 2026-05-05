"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { NewAppForm } from "@/components/apps/new-app-form";

type Props = {
  clerkEnabled: boolean;
};

export function NewAppPanel({ clerkEnabled }: Props) {
  void clerkEnabled;

  return (
    <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-muted" aria-hidden />}>
      <NewAppForm />
    </Suspense>
  );
}
