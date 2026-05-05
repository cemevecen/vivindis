import { AppDetailView } from "@/components/apps/app-detail-view";

type PageProps = {
  params: { id: string };
};

export default function AppDetailPage({ params }: PageProps) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return <AppDetailView appId={params.id} clerkEnabled={clerkEnabled} />;
}
