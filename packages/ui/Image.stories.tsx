import type { Meta, StoryObj } from '@storybook/react-vite';
import { Image } from './Image';
import { View } from './tw';

const meta = {
  title: 'UI/Image',
  component: Image,
  args: { src: 'https://picsum.photos/seed/starter/800/450', alt: 'Sample' },
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Fill: Story = {
  render: () => (
    <View className="p-4">
      <Image
        src="https://picsum.photos/seed/starter/800/450"
        alt="Sample"
        unoptimized
        className="aspect-video w-full max-w-md rounded-card"
        sizes="448px"
      />
    </View>
  ),
};
