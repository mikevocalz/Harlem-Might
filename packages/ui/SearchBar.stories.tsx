import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchBar } from './SearchBar';
import { View } from './tw';
import { Text } from './Text';
import { create } from 'zustand';

const meta = {
  title: 'UI/SearchBar',
  component: SearchBar,
  args: { value: '', onChangeText: () => {}, placeholder: 'Search…' },
} satisfies Meta<typeof SearchBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithQuery: Story = { args: { value: 'Design system' } };
export const Sized: Story = {
  render: (args) => (
    <View className="max-w-content-form p-4">
      <SearchBar {...args} value="Order My Steps" />
    </View>
  ),
};

// Story state — zustand always (repo rule).
const useDebounceStory = create<{
  query: string; deliveries: number; setQuery: (q: string) => void;
}>((set) => ({
  query: '', deliveries: 0,
  setQuery: (query) => set((s) => ({ query, deliveries: s.deliveries + 1 })),
}));

export const Debounced: Story = {
  render: function Render() {
    const { query, deliveries, setQuery } = useDebounceStory();
    return (
      <View className="max-w-content-form gap-3 p-4">
        <SearchBar value={query} onChangeText={setQuery} debounceMs={400} placeholder="Type fast…" />
        <Text variant="caption" tone="muted">
          Upstream received: “{query}” ({deliveries} deliveries — 400ms debounce via @tanstack/react-pacer)
        </Text>
      </View>
    );
  },
};
