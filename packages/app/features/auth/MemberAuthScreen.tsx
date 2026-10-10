'use client';

import { useRouter } from 'solito/navigation';
import { ErrorMessage, KeyboardAwareScroll, TextField } from '@acme/ui';
import { Form } from '@acme/ui/primitives';
import { View, Text } from '@acme/ui/tw';
import { MightsButton, MightsHeading, MightsText, routes } from '@acme/ui/mights';
import { createMemberAuthActions } from './member-auth';
import { useMemberAuth } from './member-auth.store';

export type MemberAuthIntent = 'sign-in' | 'sign-up';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

export interface MemberAuthScreenProps {
  intent: MemberAuthIntent;
  /**
   * Site origin without a trailing slash. The web wrapper passes '' so the
   * session cookie is same-origin; native passes the deployed site URL.
   */
  siteUrl: string;
}

/**
 * Shared member auth screen for web and native. Navigation is Solito and the
 * account calls stay inside `member-auth.ts`, so the two route wrappers only
 * choose the intent and API origin.
 */
export function MemberAuthScreen({ intent, siteUrl }: MemberAuthScreenProps) {
  const router = useRouter();
  const name = useMemberAuth((s) => s.name);
  const email = useMemberAuth((s) => s.email);
  const password = useMemberAuth((s) => s.password);
  const pending = useMemberAuth((s) => s.pending);
  const error = useMemberAuth((s) => s.error);
  const setField = useMemberAuth((s) => s.setField);
  const begin = useMemberAuth((s) => s.begin);
  const fail = useMemberAuth((s) => s.fail);
  const succeed = useMemberAuth((s) => s.succeed);
  const create = intent === 'sign-up';
  const emailOk = EMAIL_PATTERN.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = emailOk && passwordOk && (!create || name.trim().length > 0) && !pending;

  const submit = async () => {
    if (pending) return;
    if (!emailOk) {
      fail('Enter a valid email address.');
      return;
    }
    if (!passwordOk) {
      fail(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    if (create && !name.trim()) {
      fail('Add the name you want on your member account.');
      return;
    }
    begin();
    const actions = createMemberAuthActions(siteUrl);
    const result = create
      ? await actions.signUpEmail({ name, email, password })
      : await actions.signInEmail({ email, password });
    if (!result.ok) {
      fail(result.message);
      return;
    }
    succeed();
    router.replace(routes.explore());
  };

  return (
    <KeyboardAwareScroll contentContainerClassName="grow">
      <View className="mx-auto flex w-full max-w-content-form flex-1 justify-center px-5 py-10 sm:px-8 lg:py-16">
        <Form className="gap-8">
          <View className="gap-3">
            <Text className="font-sans text-label font-semibold uppercase tracking-[0.16em] text-primary">
              Member account
            </Text>
            <MightsHeading level={1} size="display-md">
              {create ? 'Join Harlem Might' : 'Welcome back to the block'}
            </MightsHeading>
            <MightsText size="lead">
              {create
                ? 'Create a member account to keep saved places and personal collections with you. Public exploration stays open.'
                : 'Sign in to pick up the places you saved. Exploring Harlem still does not require an account.'}
            </MightsText>
          </View>

          <ErrorMessage message={error ?? undefined} />

          <View className="gap-4">
            {create ? (
              <TextField
                label="Name"
                value={name}
                onChangeText={(value) => setField('name', value)}
                autoComplete="name"
                autoCapitalize="words"
                editable={!pending}
              />
            ) : null}
            <TextField
              label="Email"
              value={email}
              onChangeText={(value) => setField('email', value)}
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              editable={!pending}
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={(value) => setField('password', value)}
              secureTextEntry
              autoComplete={create ? 'new-password' : 'current-password'}
              hint={create ? 'At least 10 characters.' : undefined}
              editable={!pending}
              onSubmitEditing={() => void submit()}
              returnKeyType="done"
            />
          </View>

          <View className="gap-3">
            <MightsButton fill onPress={() => void submit()} disabled={!canSubmit}>
              {pending ? (create ? 'Creating account…' : 'Signing in…') : create ? 'Create account' : 'Sign in'}
            </MightsButton>
            <View className="flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-rule-hairline pt-4">
              <MightsText size="small">
                {create ? 'Already have a member account?' : 'New to Harlem Might?'}
              </MightsText>
              <MightsButton href={create ? routes.signIn() : routes.signUp()} variant="ghost" size="sm">
                {create ? 'Sign in' : 'Create one'}
              </MightsButton>
            </View>
          </View>

          <View className="gap-2 border-t border-rule-hairline pt-4">
            <View className="flex-row flex-wrap gap-2">
              <MightsButton href={routes.legal('terms')} variant="ghost" size="sm">
                Terms
              </MightsButton>
              <MightsButton href={routes.legal('privacy')} variant="ghost" size="sm">
                Privacy
              </MightsButton>
            </View>
          </View>
        </Form>
      </View>
    </KeyboardAwareScroll>
  );
}
