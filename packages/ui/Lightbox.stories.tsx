import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lightbox } from './Lightbox';
import { Button } from './Button';
import { Image } from './Image';
import { Pressable, View } from './tw';
import { create } from 'zustand';

// Story state — zustand always (repo rule).
const useLightboxStory = create<{
  open: boolean; index: number;
  openAt: (index: number) => void; close: () => void;
}>((set) => ({
  open: false, index: 0,
  openAt: (index) => set({ open: true, index }),
  close: () => set({ open: false }),
}));

const IMAGES = [
  'https://picsum.photos/seed/one/1200/800',
  'https://picsum.photos/seed/two/1200/800',
  'https://picsum.photos/seed/three/1200/800',
];

const meta = {
  title: 'UI/Lightbox',
  component: Lightbox,
  args: { images: IMAGES, open: false, onClose: () => {} },
} satisfies Meta<typeof Lightbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: function Render() {
    const { open, index, openAt, close } = useLightboxStory();
    return (
      <View className="gap-4 p-4">
        <View className="flex-row gap-3">
          {IMAGES.map((uri, i) => (
            <Pressable
              key={uri}
              aria-label={`Open image ${i + 1}`}
              onPress={() => openAt(i)}
              className="rounded-lg transition-opacity duration-fast hover:opacity-90 active:opacity-80"
            >
              <Image
                src={uri}
                alt={`Thumbnail ${i + 1}`}
                unoptimized
                className="h-24 w-32 rounded-lg border border-border/60 shadow-card"
                sizes="128px"
              />
            </Pressable>
          ))}
        </View>
        <Button title="Open lightbox" variant="outline" size="sm" onPress={() => openAt(0)} />
        <Lightbox images={IMAGES} initialIndex={index} open={open} onClose={close} />
      </View>
    );
  },
};
