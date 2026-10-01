import { tv } from 'tailwind-variants';
import { View } from './tw';
import { FadeIn, ScaleIn } from './motion';
import { Text } from './Text';

const emptyState = tv({
  slots: {
    root: 'items-center justify-center gap-2 p-10',
    icon: 'mb-2 h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-sunken',
    title: 'text-center',
    description: 'max-w-content-form text-center',
    action: 'mt-3 items-center',
  },
});

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const s = emptyState();
  return (
    <FadeIn className={s.root({ className })}>
      <ScaleIn aria-hidden delay={80} className={s.icon()}>{icon}</ScaleIn>
      <Text variant="heading" className={s.title()}>{title}</Text>
      {description ? (
        <Text tone="muted" className={s.description()}>{description}</Text>
      ) : null}
      {action ? <View className={s.action()}>{action}</View> : null}
    </FadeIn>
  );
}
