import { Linking } from 'react-native';
import { useRouter } from 'solito/navigation';
import { notify } from '@acme/ui';
import { ChevronRight, ExternalLink } from '@acme/ui/icons';
import { secondaryNav } from '@acme/ui/mights';
import { Pressable, Text, View } from '@acme/ui/tw';
import { SitePage } from './SitePage';
import { siteUrl } from './site-url';

type SecondaryLabel = (typeof secondaryNav)[number]['label'];

// "The app" is struck here: it is the download page, and the reader is already
// in the app. Every other secondaryNav entry keeps the site's label and order.
const STRUCK: ReadonlySet<SecondaryLabel> = new Set(['The app']);

// AR concept, Sign in and Create account have native routes. About, Press and
// the legal pages open on the site: their copy lives in apps/web/content and is
// not shared with the app yet (DEFER, PARITY_AUDIT P3).
const NATIVE_PAGES: ReadonlySet<SecondaryLabel> = new Set(['AR concept', 'Sign in', 'Create account']);

async function openOnSite(label: string, url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    notify.error(`Couldn’t open ${label}`, { description: `${String(error)}. The page is at ${url}.` });
  }
}

/**
 * More: the site's secondary navigation as a plain list, one row per page.
 * Native rows push inside the tab; site rows open the browser and say so with
 * an external-link glyph. Without a site address in this build, site rows are
 * disabled and say why.
 */
export function MoreScreen() {
  const router = useRouter();
  const rows = secondaryNav.filter((item) => !STRUCK.has(item.label));

  return (
    <SitePage title="More">
      <View className="max-w-content-detail border-t border-rule-hairline">
        {rows.map((item) => {
          const native = NATIVE_PAGES.has(item.label);
          const url = native ? undefined : siteUrl(item.href);
          const disabled = !native && !url;
          return (
            <Pressable
              key={item.label}
              role="link"
              aria-label={native || disabled ? item.label : `${item.label}, opens the website`}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => {
                if (native) router.push(item.href);
                else if (url) void openOnSite(item.label, url);
              }}
              className="min-h-target flex-row items-center gap-3 border-b border-rule-hairline py-3 active:bg-surface-sunken"
            >
              <View className="flex-1 gap-0.5">
                <Text className={`font-sans text-body ${disabled ? 'text-text-muted' : 'text-text'}`}>{item.label}</Text>
                {disabled ? (
                  <Text className="font-sans text-small text-text-muted">
                    This build has no website address, so this page can’t open.
                  </Text>
                ) : null}
              </View>
              {native ? (
                <ChevronRight size={20} className="text-text-muted" />
              ) : disabled ? null : (
                <ExternalLink size={18} className="text-text-muted" />
              )}
            </Pressable>
          );
        })}
      </View>
    </SitePage>
  );
}
