import { MemberAuthScreen } from '@acme/app/features/auth/MemberAuthScreen.tsx';
import { siteOrigin } from '@/src/site/site-url';

export default function SignUpRoute() {
  return <MemberAuthScreen intent="sign-up" siteUrl={siteOrigin() ?? ''} />;
}
