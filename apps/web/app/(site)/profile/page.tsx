import type { Metadata } from 'next';
import { MemberProfileScreen } from '@acme/app/features/auth/MemberProfileScreen.tsx';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Your Harlem Might member account and saved places.',
};

export default function ProfilePage() {
  return <MemberProfileScreen siteUrl="" />;
}
