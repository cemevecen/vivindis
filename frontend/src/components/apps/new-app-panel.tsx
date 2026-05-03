"use client";

import { useTranslations } from "next-intl";

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

  return <NewAppForm />;
}
