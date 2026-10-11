import { MemberProfileScreen } from '@acme/app/features/auth/MemberProfileScreen.tsx';
import { siteOrigin } from '@/src/site/site-url';

export default function ProfileRoute() {
  return <MemberProfileScreen siteUrl={siteOrigin() ?? ''} />;
}
