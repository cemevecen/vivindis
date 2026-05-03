import { z } from "zod";

export function createFetchCreateSchema(t: (key: string) => string) {
  return z
    .object({
      from_date: z.string().min(1, { message: t("validationFrom") }),
      to_date: z.string().min(1, { message: t("validationTo") }),
    })
    .superRefine((data, ctx) => {
      const a = Date.parse(data.from_date);
      const b = Date.parse(data.to_date);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        ctx.addIssue({ code: "custom", message: t("validationDates"), path: ["to_date"] });
        return;
      }
      if (a > b) {
        ctx.addIssue({ code: "custom", message: t("validationDates"), path: ["to_date"] });
      }
    });
}

export type FetchCreateFormValues = z.infer<ReturnType<typeof createFetchCreateSchema>>;
