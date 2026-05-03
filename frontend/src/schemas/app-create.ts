import { z } from "zod";

export function createAppCreateSchema(t: (key: string) => string) {
  return z
    .object({
      platform: z.enum(["google_play", "app_store", "both"]),
      package_name: z.string().min(1, { message: t("validationPackage") }).max(255),
      bundle_id: z.string().max(255).optional(),
      name: z.string().min(1, { message: t("validationName") }).max(512),
      developer: z.string().max(512).optional(),
      category: z.string().max(255).optional(),
      icon_url: z.string().max(2048).optional(),
    })
    .superRefine((data, ctx) => {
      const needsBundle = data.platform === "app_store" || data.platform === "both";
      const bundle = (data.bundle_id ?? "").trim();
      if (needsBundle && !bundle) {
        ctx.addIssue({
          code: "custom",
          message: t("validationBundle"),
          path: ["bundle_id"],
        });
      }
      const icon = (data.icon_url ?? "").trim();
      if (icon.length > 0) {
        let valid = false;
        try {
          new URL(icon);
          valid = true;
        } catch {
          valid = false;
        }
        if (!valid) {
          ctx.addIssue({
            code: "custom",
            message: t("validationIconUrl"),
            path: ["icon_url"],
          });
        }
      }
    });
}

export type AppCreateFormValues = z.infer<ReturnType<typeof createAppCreateSchema>>;
