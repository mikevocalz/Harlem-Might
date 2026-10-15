import { MemberAuthScreen } from '@acme/app/features/auth/MemberAuthScreen.tsx';
import { siteOrigin } from '@/src/site/site-url';

export default function SignInRoute() {
  return <MemberAuthScreen intent="sign-in" siteUrl={siteOrigin() ?? ''} />;
}
