'use client';
import { useRouter } from 'solito/navigation';
import { ErrorScreen as Shared, type ErrorScreenProps } from './screen.shared';

export function ErrorScreen(props: Omit<ErrorScreenProps, 'onGoHome'>) {
  const router = useRouter();
  return <Shared {...props} onGoHome={() => router.push('/')} />;
}
