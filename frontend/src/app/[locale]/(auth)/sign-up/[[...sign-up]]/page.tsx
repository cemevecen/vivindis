import { redirect } from "next/navigation";

type Props = {
  params: { locale: string };
};

export default function SignUpPage({ params }: Props) {
  const { locale } = params;
  redirect(`/${locale}/dashboard`);
}
