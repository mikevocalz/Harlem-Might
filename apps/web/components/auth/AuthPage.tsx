import { getHarlemArchivalImage } from '@acme/app/content';
import {
  MemberAuthScreen,
  type MemberAuthIntent,
} from '@acme/app/features/auth/MemberAuthScreen.tsx';
import { Image } from '@acme/ui';
import { Figcaption, Figure, Link, Main, Section } from '@acme/ui/html';
import { MightsText, MightsWordmark } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { AuthBackButton } from './AuthBackButton';

const image = getHarlemArchivalImage('nypl-lenox-avenue-135th-1939');

/**
 * The two-column auth shell: a credited Harlem photograph leads on wide
 * screens, then the shared Solito member screen. Below lg the form owns the
 * page so the image never competes with the keyboard.
 */
export function AuthPage({ intent }: { intent: MemberAuthIntent }) {
  return (
    <Main className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <Section
        aria-labelledby="auth-image-title"
        className="relative hidden min-h-0 overflow-hidden bg-mights-night lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start"
      >
        {image ? (
          <View className="absolute inset-0">
            <Image
              src={image.url}
              alt={image.altText}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              // Fills the column top to bottom; the caption sits over the foot.
              contentFit="cover"
              className="h-full w-full"
            />
          </View>
        ) : null}
        <View aria-hidden className="absolute inset-0 bg-mights-night/35" />
        <View className="absolute left-8 top-8 flex-row items-center gap-4">
          <AuthBackButton />
          <MightsWordmark />
        </View>
        <Figure className="absolute inset-x-0 bottom-0 border-t border-rule-hairline bg-surface/90 p-8 backdrop-blur-sm">
          <Figcaption id="auth-image-title" className="flex flex-col gap-2">
            <MightsText tone="default" className="font-semibold">
              {image?.caption}
            </MightsText>
            {image ? (
              <MightsText size="small">
                {image.capturedAt}. {image.creator}.{' '}
                <Link className="underline underline-offset-2" href={image.sourceUrl} target="_blank" rel="noreferrer">
                  {image.attributionText}
                </Link>
                {' · '}
                <Link className="underline underline-offset-2" href={image.licenseUrl} target="_blank" rel="noreferrer">
                  Rights statement
                </Link>
              </MightsText>
            ) : null}
            <MightsText size="small">
              Archival Harlem photography is historical context, not a current venue photograph.
            </MightsText>
          </Figcaption>
        </Figure>
      </Section>
      <Section aria-label={intent === 'sign-up' ? 'Create a member account' : 'Sign in'} className="flex min-w-0 flex-col">
        {/* Below lg the photo column (and its logo row) is hidden; the way back stays. */}
        <View className="flex-row items-center gap-4 px-6 pt-6 lg:hidden">
          <AuthBackButton />
          <MightsWordmark />
        </View>
        <MemberAuthScreen intent={intent} siteUrl="" />
      </Section>
    </Main>
  );
}
