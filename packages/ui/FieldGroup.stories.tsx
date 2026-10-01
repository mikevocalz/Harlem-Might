import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldGroup } from './FieldGroup';
import { TextField } from './TextField';
import { Switch } from './Switch';
import { View } from './tw';

const meta = {
  title: 'UI/FieldGroup',
  component: FieldGroup,
  args: { children: null },
} satisfies Meta<typeof FieldGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SettingsForm: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <FieldGroup>
        <FieldGroup.Section title="Profile">
          <TextField label="Full name" defaultValue="Maya Rodriguez" />
          <TextField label="Email" defaultValue="maya@example.com" hint="Used for sign-in." />
        </FieldGroup.Section>
        <FieldGroup.Section title="Notifications">
          <Switch value onChange={() => {}} label="Rehearsal reminders" />
          <Switch value={false} onChange={() => {}} label="Weekly digest" />
          <FieldGroup.SectionFooter>
            Reminders arrive the evening before a rehearsal.
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </View>
  ),
};
