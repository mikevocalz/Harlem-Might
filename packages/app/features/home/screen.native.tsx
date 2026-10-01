'use client';
import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { HomeContent } from './home-content';

export function HomeScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <HomeContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
