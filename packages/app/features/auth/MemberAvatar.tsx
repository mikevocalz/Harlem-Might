import { Image } from '@acme/ui';
import { cornerCutSm, expanded } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';

// The member mark, in the Mights language: a square tile with the signature
// diagonal corner cut — never a circle (the design audit is explicit that the
// language is clip-path cuts, and the legacy rounded Avatar is an
// anti-reference). The member's own avatar image when they have one,
// gold-on-iron initials when they don't.

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

export function MemberAvatar({
  name,
  imageUri,
  size = 'sm',
}: {
  name: string;
  imageUri?: string | null;
  /** 'sm' is the navbar/account control; 'lg' a list row; 'xl' the profile masthead. */
  size?: 'sm' | 'lg' | 'xl';
}) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-20 w-20' : 'h-28 w-28';
  const type = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-2xl' : 'text-4xl';
  const initials = initialsOf(name) || 'HM';
  return (
    <View
      role="img"
      aria-label={name}
      className={`relative shrink-0 overflow-hidden bg-primary ${cornerCutSm} ${box}`}
    >
      {imageUri ? (
        <Image src={imageUri} alt={name} fill unoptimized contentFit="cover" className="h-full w-full" />
      ) : (
        <View className="flex h-full w-full items-center justify-center">
          <Text className={`font-sans font-bold tracking-[0.04em] text-on-primary ${expanded} ${type}`}>
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
}
