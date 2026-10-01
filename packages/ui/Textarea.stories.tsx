import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';
import type { PasteEventPayload } from './TextField';
import { View } from './tw';
import { Text } from './Text';
import { Image } from './Image';
import { create } from 'zustand';

// Story state — zustand always (repo rule).
const usePasteStory = create<{
  value: string; images: string[];
  setValue: (value: string) => void; addImages: (uris: string[]) => void;
}>((set) => ({
  value: '', images: [],
  setValue: (value) => set({ value }),
  addImages: (uris) => set((s) => ({ images: [...s.images, ...uris] })),
}));

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  args: { label: 'Bio' },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <Textarea label="Bio" placeholder="A few words about you" />
      <Textarea label="Notes" hint="Visible to your team." placeholder="Notes" />
      <Textarea label="Required" error="This field is required." placeholder="Say something" />
      <Textarea label="Locked" disabled placeholder="Read only" />
    </View>
  ),
};

export const WithPaste: Story = {
  render: function Render() {
    const { value, setValue, images, addImages } = usePasteStory();
    const onPaste = (payload: PasteEventPayload) => {
      // Text pastes insert into the field natively (value arrives via onChangeText).
      if (payload.type === 'images') addImages(payload.uris);
    };
    return (
      <View className="max-w-content-form gap-4 p-4">
        <Textarea
          label="Description"
          placeholder="Write, or paste text and images…"
          hint="Copy an image to the clipboard, then paste it into the field."
          value={value}
          onChangeText={setValue}
          onPaste={onPaste}
        />
        {images.length ? (
          <View className="flex-row flex-wrap gap-3">
            {images.map((uri, i) => (
              <Image
                key={i}
                src={uri}
                alt="Pasted"
                unoptimized
                className="h-20 w-20 rounded-lg border border-border/60 shadow-card"
              />
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="muted">Pasted images appear here.</Text>
        )}
      </View>
    );
  },
};
