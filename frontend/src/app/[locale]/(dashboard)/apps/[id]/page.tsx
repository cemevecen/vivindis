import { AppDetailView } from "@/components/apps/app-detail-view";

type PageProps = {
  params: { id: string };
};

export default function AppDetailPage({ params }: PageProps) {
  return <AppDetailView appId={params.id} clerkEnabled />;
}
