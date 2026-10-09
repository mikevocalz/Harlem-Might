'use client';

import { useRouter } from 'solito/navigation';
import { IconButton } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { routes } from '@acme/ui/mights';

/**
 * Leaves the auth screen: back to the page that opened it, or home when the
 * visitor landed here directly (no in-site history to return to).
 */
export function AuthBackButton() {
  const router = useRouter();
  return (
    <IconButton
      variant="outline"
      size="md"
      aria-label="Go back"
      icon={<ChevronLeft size={20} className="text-text" />}
      onPress={() => {
        // Only step back when the previous page was on this site; a direct
        // landing (new tab, external link) would otherwise leave the site.
        const fromSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (fromSite) router.back();
        else router.push(routes.home());
      }}
    />
  );
}
