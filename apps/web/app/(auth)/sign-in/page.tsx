import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth/AuthPage';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to a Harlem Might member account.',
};

export default function SignInPage() {
  return <AuthPage intent="sign-in" />;
}
