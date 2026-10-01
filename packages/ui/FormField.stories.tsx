import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from './FormField';
import { TextField } from './TextField';
import { Input } from './primitives';
import { View } from './tw';

const meta = {
  title: 'UI/FormField',
  component: FormField,
  args: { label: 'Field', children: null },
} satisfies Meta<typeof FormField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WrappingCustomControls: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <FormField label="Custom control" hint="FormField wraps anything.">
        <Input
          aria-label="Custom control"
          className="rounded-md border border-border bg-surface-raised px-3 py-2.5 text-text"
        />
      </FormField>
      <FormField label="With error" error="Something is off.">
        <Input
          aria-label="With error"
          className="rounded-md border border-danger bg-surface-raised px-3 py-2.5 text-text"
        />
      </FormField>
      <TextField label="Compare: TextField" placeholder="Composed variant" />
    </View>
  ),
};
