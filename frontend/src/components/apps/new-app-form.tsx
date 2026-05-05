"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { useRouter } from "@/i18n/routing";
import { ApiError, apiFetch } from "@/lib/api";
import { usePublicToken } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { createAppCreateSchema, type AppCreateFormValues } from "@/schemas/app-create";
import type { AppDto } from "@/types/app";

const platforms = ["google_play", "app_store", "both"] as const;

export function NewAppForm() {
  const t = useTranslations("apps");
  const tCommon = useTranslations("common");
  const getToken = usePublicToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const schema = useMemo(() => createAppCreateSchema((key) => t(key)), [t]);

  const form = useForm<AppCreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platform: "google_play",
      package_name: "",
      bundle_id: "",
      name: "",
      developer: "",
      category: "",
      icon_url: "",
    },
  });

  useEffect(() => {
    const p = searchParams.get("platform");
    const platform =
      p && platforms.includes(p as (typeof platforms)[number]) ? (p as AppCreateFormValues["platform"]) : undefined;
    const package_name = searchParams.get("package_name")?.trim() ?? "";
    const bundle_id = searchParams.get("bundle_id")?.trim() ?? "";
    const name = searchParams.get("name")?.trim() ?? "";
    const developer = searchParams.get("developer")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const icon_url = searchParams.get("icon_url")?.trim() ?? "";
    if (!platform && !package_name && !bundle_id && !name && !developer && !category && !icon_url) {
      return;
    }
    form.reset({
      platform: platform ?? "google_play",
      package_name,
      bundle_id,
      name,
      developer,
      category,
      icon_url,
    });
  }, [form, searchParams]);

  const mutation = useMutation({
    mutationFn: async (values: AppCreateFormValues) => {
      const body = {
        platform: values.platform,
        package_name: values.package_name.trim(),
        bundle_id: values.bundle_id?.trim() ? values.bundle_id.trim() : null,
        name: values.name.trim(),
        developer: values.developer?.trim() ? values.developer.trim() : null,
        category: values.category?.trim() ? values.category.trim() : null,
        icon_url: values.icon_url?.trim() ? values.icon_url.trim() : null,
        is_active: true,
      };
      return apiFetch<AppDto>("/api/v1/apps", { method: "POST", body, getToken });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
      toast.success(t("created"));
      const fd = searchParams.get("from_date")?.trim();
      const td = searchParams.get("to_date")?.trim();
      const pair = searchParams.get("pair_app_id")?.trim();
      const q = new URLSearchParams();
      if (fd) q.set("from_date", fd);
      if (td) q.set("to_date", td);
      if (pair) q.set("pair_app_id", pair);
      const qs = q.toString();
      router.push(`/apps/${data.id}${qs ? `?${qs}` : ""}`);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : tCommon("error");
      toast.error(msg);
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="platform">{t("platform")}</Label>
        <SelectNative id="platform" {...form.register("platform")}>
          <option value="google_play">{t("platformGooglePlay")}</option>
          <option value="app_store">{t("platformAppStore")}</option>
          <option value="both">{t("platformBoth")}</option>
        </SelectNative>
        {form.formState.errors.platform ? (
          <p className="text-xs text-destructive">{form.formState.errors.platform.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" autoComplete="off" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="package_name">{t("packageName")}</Label>
        <Input id="package_name" autoComplete="off" {...form.register("package_name")} />
        {form.formState.errors.package_name ? (
          <p className="text-xs text-destructive">{form.formState.errors.package_name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bundle_id">{t("bundleId")}</Label>
        <Input id="bundle_id" autoComplete="off" {...form.register("bundle_id")} />
        {form.formState.errors.bundle_id ? (
          <p className="text-xs text-destructive">{form.formState.errors.bundle_id.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="developer">{t("developer")}</Label>
          <Input id="developer" autoComplete="off" {...form.register("developer")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">{t("category")}</Label>
          <Input id="category" autoComplete="off" {...form.register("category")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="icon_url">{t("iconUrl")}</Label>
        <Input id="icon_url" type="url" autoComplete="off" {...form.register("icon_url")} />
        {form.formState.errors.icon_url ? (
          <p className="text-xs text-destructive">{form.formState.errors.icon_url.message}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? tCommon("loading") : t("createSubmit")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/apps")}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
