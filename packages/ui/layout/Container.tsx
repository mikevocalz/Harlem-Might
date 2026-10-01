import { tv } from 'tailwind-variants';
import { View } from '../tw';

/**
 * §8.2 Container — the ONLY place content max-widths live. Every screen's
 * scrollable content wraps in one; cards fill their container, the container
 * owns the cap. Token-typed: widths come from @acme/theme contentWidths.
 */
const container = tv({
  base: 'w-full self-center px-4 sm:px-6',
  variants: {
    width: {
      form: 'max-w-content-form',
      feed: 'max-w-content-feed',
      prose: 'max-w-content-prose',
      detail: 'max-w-content-detail',
      screen: 'max-w-content-screen',
      wide: 'max-w-content-wide',
      full: 'max-w-none px-0',
    },
  },
  defaultVariants: { width: 'screen' },
});

export interface ContainerProps extends React.ComponentProps<typeof View> {
  width?: 'form' | 'feed' | 'prose' | 'detail' | 'screen' | 'wide' | 'full';
}

export function Container({ width, className, ...props }: ContainerProps) {
  return <View className={container({ width, className })} {...props} />;
}
