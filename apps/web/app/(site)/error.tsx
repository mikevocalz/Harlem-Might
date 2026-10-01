'use client';

import { ErrorScreen } from '@acme/app';

export default function ErrorPage({ error }: { error: Error }) {
  return <ErrorScreen kind="error" detail={error.message} />;
}
