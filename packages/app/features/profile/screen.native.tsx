'use client';
import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { ProfileContent } from './profile-content';

export function ProfileScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <ProfileContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
