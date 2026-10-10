import { MemberAuthScreen } from '@acme/app/features/auth/MemberAuthScreen.tsx';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function SignInRoute() {
  return <MemberAuthScreen intent="sign-in" siteUrl={SITE_URL} />;
}
