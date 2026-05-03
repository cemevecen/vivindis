import { SignIn } from "@clerk/nextjs";

type Props = {
  params: { locale: string };
};

export default function SignInPage({ params }: Props) {
  const { locale } = params;
  return (
    <SignIn
      routing="path"
      path={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      afterSignInUrl={`/${locale}/dashboard`}
    />
  );
}
