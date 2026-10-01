'use client';
import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { HomeContent } from './home-content';

export function HomeScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <HomeContent />
      </Container>
    </Main>
  );
}
