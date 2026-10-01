'use client';
import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { ProfileContent } from './profile-content';

export function ProfileScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <ProfileContent />
      </Container>
    </Main>
  );
}
