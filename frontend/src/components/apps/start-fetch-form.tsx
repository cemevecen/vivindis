"use client";

import { useAuth } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { createFetchCreateSchema, type FetchCreateFormValues } from "@/schemas/fetch-create";
import type { ReviewFetchDto } from "@/types/app";

function defaultDateRange(): FetchCreateFormValues {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from_date: iso(from), to_date: iso(to) };
}

type Props = {
  appId: string;
};

export function StartFetchForm({ appId }: Props) {
  const t = useTranslations("apps");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const schema = useMemo(() => createFetchCreateSchema((key) => t(key)), [t]);
  const defaults = useMemo(() => defaultDateRange(), []);

  const form = useForm<FetchCreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const fd = searchParams.get("from_date")?.trim();
    const td = searchParams.get("to_date")?.trim();
    if (fd && td) {
      form.reset({ from_date: fd, to_date: td });
    }
  }, [searchParams, form, appId]);

  const mutation = useMutation({
    mutationFn: async (values: FetchCreateFormValues) => {
      const body = {
        from_date: values.from_date,
        to_date: values.to_date,
        review_scope: "global" as const,
      };
      return apiFetch<ReviewFetchDto>(`/api/v1/apps/${appId}/fetch`, {
        method: "POST",
        body,
        getToken,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
      toast.success(t("fetchStarted"));
      form.reset(defaultDateRange());
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : tCommon("error");
      toast.error(msg);
    },
  });

  const dateLocale = locale === "tr" ? "tr-TR" : locale;

  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      noValidate
    >
      <p className="text-sm font-medium">{t("fetchSection")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from_date">{t("fromDate")}</Label>
          <Input id="from_date" type="date" lang={dateLocale} {...form.register("from_date")} />
          {form.formState.errors.from_date ? (
            <p className="text-xs text-destructive">{form.formState.errors.from_date.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="to_date">{t("toDate")}</Label>
          <Input id="to_date" type="date" lang={dateLocale} {...form.register("to_date")} />
          {form.formState.errors.to_date ? (
            <p className="text-xs text-destructive">{form.formState.errors.to_date.message}</p>
          ) : null}
        </div>
      </div>
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? tCommon("loading") : t("startFetch")}
      </Button>
    </form>
  );
}
