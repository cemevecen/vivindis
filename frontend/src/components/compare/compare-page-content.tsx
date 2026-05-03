"use client";

import { GitCompare } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  heading: string;
  emptyTitle: string;
  emptyDescription: string;
  cta: string;
};

export function ComparePageContent({ heading, emptyTitle, emptyDescription, cta }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <EmptyState icon={GitCompare} title={emptyTitle} description={emptyDescription}>
        <Link href="/apps" className={cn(buttonVariants())}>
          {cta}
        </Link>
      </EmptyState>
    </div>
  );
}
