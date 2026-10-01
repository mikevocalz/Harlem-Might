'use client';
import { View } from '@acme/ui/tw';
import { Container, Heading, Text, Button } from '@acme/ui';

export interface ErrorScreenProps {
  /** 404 vs generic failure */
  kind?: 'not-found' | 'error';
  detail?: string;
  onGoHome?: () => void;
}

/** ONE error page for Expo +not-found AND Next not-found/error (user rule —
 *  the same screen serves both, dvnt-monorepo style). */
export function ErrorScreen({ kind = 'not-found', detail, onGoHome }: ErrorScreenProps) {
  const notFound = kind === 'not-found';
  return (
    <View className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 items-center justify-center bg-surface p-6">
      <Container width="form" className="items-center gap-4">
        <Text className="font-display text-display-xl text-burgundy-200">
          {notFound ? '404' : '!'}
        </Text>
        <View className="items-center gap-1">
          <Heading level={1} size="display-sm" className="text-center">
            {notFound ? 'Page not found' : 'Something went wrong'}
          </Heading>
          <Text tone="muted" className="text-center">
            {detail ??
              (notFound
                ? 'The page you are looking for does not exist or has moved.'
                : 'An unexpected error occurred. Try again in a moment.')}
          </Text>
        </View>
        <Button title="Back to Home" onPress={onGoHome} />
      </Container>
    </View>
  );
}
