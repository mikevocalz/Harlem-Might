import { tv, type VariantProps } from 'tailwind-variants';
import { Avatar, type AvatarProps } from './Avatar';
import { View, Text } from './tw';

const identity = tv({
  slots: {
    root: 'min-w-0 flex-row items-center',
    copy: 'min-w-0 flex-1',
    name: 'truncate font-semibold text-text',
    detail: 'truncate text-text-muted',
  },
  variants: {
    density: {
      compact: { root: 'gap-2', name: 'text-sm', detail: 'text-xs' },
      comfortable: { root: 'gap-3', name: 'text-sm md:text-base', detail: 'text-xs md:text-sm' },
    },
  },
  defaultVariants: { density: 'comfortable' },
});

export interface BusinessIdentityProps extends VariantProps<typeof identity> {
  name: string;
  logoUri?: string | null;
  detail?: string;
  size?: AvatarProps['size'];
  className?: string;
}

export function BusinessIdentity({
  name,
  logoUri,
  detail,
  size = 'md',
  density,
  className,
}: BusinessIdentityProps) {
  const styles = identity({ density });

  return (
    <View className={styles.root({ className })}>
      <Avatar name={name} imageUri={logoUri} entity="business" size={size} />
      <View className={styles.copy()}>
        <Text className={styles.name()}>{name}</Text>
        {detail ? <Text className={styles.detail()}>{detail}</Text> : null}
      </View>
    </View>
  );
}
