import type { Meta, StoryObj } from '@storybook/react-vite';
import { useAppForm } from './form';
import { View } from './tw';
import { Text } from './Text';

const meta = { title: 'UI/Form' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Profile: Story = {
  render: function Render() {
    const form = useAppForm({
      defaultValues: { name: '', bio: '', terms: false, notifications: true },
      onSubmit: async ({ value }) => {
        // eslint-disable-next-line no-alert
        alert(JSON.stringify(value, null, 2));
      },
    });
    return (
      <View className="max-w-content-form gap-4 p-4">
        <form.AppField
          name="name"
          validators={{ onChange: ({ value }) => (!value ? 'Name is required.' : undefined) }}
        >
          {(field) => <field.TextField label="Full name" placeholder="Maya Rodriguez" />}
        </form.AppField>
        <form.AppField
          name="bio"
          validators={{
            onChange: ({ value }) => (value.length > 160 ? 'Keep it under 160 characters.' : undefined),
          }}
        >
          {(field) => <field.Textarea label="Bio" placeholder="A few words about you" hint="Max 160 characters." />}
        </form.AppField>
        <form.AppField name="notifications">
          {(field) => <field.Switch label="Email notifications" />}
        </form.AppField>
        <form.AppField
          name="terms"
          validators={{ onChange: ({ value }) => (!value ? 'You must accept the terms.' : undefined) }}
        >
          {(field) => <field.Checkbox label="Accept terms" />}
        </form.AppField>
        <View className="gap-2 pt-2">
          <form.AppForm>
            <form.SubmitButton title="Save profile" />
          </form.AppForm>
          <Text variant="caption" tone="muted">
            Validates on change; submit stays disabled until the form is valid.
          </Text>
        </View>
      </View>
    );
  },
};
