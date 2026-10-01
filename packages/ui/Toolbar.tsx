import { tv } from 'tailwind-variants';
import { Header, Nav } from './primitives';
import { View, Text } from './tw';

// §9 contextual top bar — presentational: leading control (back/menu) and the
// trailing action row (IconButtons) are passed in as slots.
const toolbar = tv({
  slots: {
    root: 'h-14 flex-row items-center justify-between border-b-2 border-border bg-surface px-4',
    leading: 'flex-row items-center gap-2',
    title: 'flex-1 px-3 text-lg font-semibold text-text',
    actions: 'flex-row items-center gap-1',
  },
});

export interface ToolbarProps {
  title?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Toolbar({ title, leading, actions, className }: ToolbarProps) {
  const s = toolbar();
  return (
    <Header aria-label={title} className={s.root({ className })}>
      {leading ? <View className={s.leading()}>{leading}</View> : null}
      {title ? (
        <Text numberOfLines={1} className={s.title()}>
          {title}
        </Text>
      ) : null}
      {actions ? <Nav className={s.actions()}>{actions}</Nav> : null}
    </Header>
  );
}
