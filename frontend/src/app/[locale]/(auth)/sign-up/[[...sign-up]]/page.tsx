import { SignUp } from "@clerk/nextjs";

type Props = {
  params: { locale: string };
};

export default function SignUpPage({ params }: Props) {
  const { locale } = params;
  return (
    <SignUp
      routing="path"
      path={`/${locale}/sign-up`}
      signInUrl={`/${locale}/sign-in`}
      afterSignUpUrl={`/${locale}/analyze`}
    />
  );
}
