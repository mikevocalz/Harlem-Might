import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './TabBar';
import { Text } from './tw';

const glyph = (g: string) => <Text className="text-lg">{g}</Text>;

const meta = {
  title: 'UI/TabBar',
  component: TabBar,
  args: {
    tabs: [
      { key: 'home', label: 'Home', icon: glyph('⌂'), active: true },
      { key: 'events', label: 'Events', icon: glyph('🗓') },
      { key: 'listen', label: 'Listen', icon: glyph('▸') },
      { key: 'people', label: 'People', icon: glyph('☺') },
      { key: 'more', label: 'More', icon: glyph('…') },
    ],
  },
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmphasizedCenter: Story = {
  args: { emphasizedKey: 'listen' },
};

export const SecondTabActive: Story = {
  args: {
    tabs: [
      { key: 'home', label: 'Home', icon: glyph('⌂') },
      { key: 'events', label: 'Events', icon: glyph('🗓'), active: true },
      { key: 'listen', label: 'Listen', icon: glyph('▸') },
    ],
  },
};
