'use client';

import { ErrorScreen } from '@acme/app';

export default function NotFound() {
  return <ErrorScreen kind="not-found" />;
}
