import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/AuthPage';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a Harlem Might member account for saved places and collections.',
};

export default function SignUpPage() {
  return <AuthPage intent="sign-up" />;
}
