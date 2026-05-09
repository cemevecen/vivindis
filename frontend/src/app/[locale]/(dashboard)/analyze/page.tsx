import { redirect } from "next/navigation";

import { AnalyzeHubSuspense } from "@/components/analyze/analyze-hub-suspense";
import { parseAnalyzeHubMode } from "@/lib/analyze-hub-utils";

type Props = {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

function firstQueryString(v: string | string[] | undefined): string | null {
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return null;
}

/** Eski `/tr/analyze` ve `?mode=store` adresleri tek kanonik mağaza URL’sine gider; dosya/metin/karşılaştırma burada kalır. */
export default function AnalyzePage({ params, searchParams }: Props) {
  const mode = parseAnalyzeHubMode(firstQueryString(searchParams.mode));
  if (mode === "store") {
    redirect(`/${params.locale}/analyze/store`);
  }
  return <AnalyzeHubSuspense />;
}
