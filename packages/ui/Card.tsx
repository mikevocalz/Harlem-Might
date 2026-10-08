import { tv, type VariantProps } from './tv';
import { Article } from './primitives';

const card = tv({
  base: 'rounded-card bg-surface-raised',
  variants: {
    elevation: {
      flat: 'border-2 border-border',
      card: 'border-2 border-border shadow-card',
      raised: 'border-2 border-border shadow-raised',
    },
    padded: { true: 'p-5', false: 'overflow-hidden' },
  },
  defaultVariants: { elevation: 'card', padded: true },
});

export interface CardProps
  extends React.ComponentProps<typeof Article>,
    VariantProps<typeof card> {}

export function Card({ elevation, padded, className, ...props }: CardProps) {
  return <Article className={card({ elevation, padded, className })} {...props} />;
}
