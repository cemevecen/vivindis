import { redirect } from "next/navigation";

type Props = {
  params: { locale: string };
};

/** Eski /dashboard bağlantıları ve yer imleri → Analiz. */
export default function DashboardRedirectPage({ params }: Props) {
  redirect(`/${params.locale}/analyze/store`);
}
