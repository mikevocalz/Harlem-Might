'use client';
import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { SettingsContent } from './settings-content';

export function SettingsScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <SettingsContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
