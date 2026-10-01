import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Page, Main, Header, Footer, Nav, Section, Article, Aside,
  Figure, Figcaption, Address, Details, Summary,
  Heading, Paragraph, Text, Time, List, ListItem,
  Button, Link, Form, Fieldset, Legend, Label, Input, Textarea, Select,
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell,
} from './index';

// §7: every primitive rendered semantically — the a11y addon audits each story.

const meta = { title: 'Primitives' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Landmarks: Story = {
  render: () => (
    <Page className="gap-4 bg-surface p-6">
      <Header className="border-b-2 border-border pb-3">
        <Nav className="flex-row gap-4">
          <Link href="https://example.com" className="font-semibold text-text underline decoration-primary decoration-2">Home</Link>
          <Link href="https://example.com/social" className="font-semibold text-text underline decoration-primary decoration-2">Instagram</Link>
        </Nav>
      </Header>
      <Main className="gap-4">
        <Section className="gap-2">
          <Heading level={2} className="font-display text-display-sm text-text">Schedule</Heading>
          <Article className="gap-1 rounded-card bg-surface-raised p-4 shadow-card">
            <Heading level={3} className="text-lg font-semibold text-text">Tuesday standup</Heading>
            <Paragraph className="text-text-muted">Whole team — bring your quarterly notes.</Paragraph>
            <Time className="text-sm text-text-muted">9:00 AM</Time>
          </Article>
        </Section>
        <Aside className="rounded-card bg-surface-sunken p-4">
          <Paragraph className="text-sm text-text-muted">From the team lead</Paragraph>
        </Aside>
      </Main>
      <Footer className="border-t-2 border-border pt-3">
        <Address className="text-sm text-text-muted">Harlem, New York</Address>
      </Footer>
    </Page>
  ),
};

export const ContentAndLists: Story = {
  render: () => (
    <Page className="gap-4 bg-surface p-6">
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level} className="font-display text-text">
          Heading level {level}
        </Heading>
      ))}
      <Paragraph className="text-text">
        Body paragraph with <Text className="font-semibold text-accent">inline text</Text> inside.
      </Paragraph>
      <Figure className="gap-1">
        <Text className="text-4xl">🖼️</Text>
        <Figcaption className="text-sm text-text-muted">A caption for the figure</Figcaption>
      </Figure>
      <Details className="rounded-md border-2 border-border p-3">
        <Summary className="font-semibold text-text">Release notes (details/summary)</Summary>
        <Paragraph className="pt-2 text-text-muted">Highlights from the latest release.</Paragraph>
      </Details>
      <List className="gap-1 pl-4">
        <ListItem className="text-text">First item</ListItem>
        <ListItem className="text-text">Second item</ListItem>
        <ListItem className="text-text">Third item</ListItem>
      </List>
    </Page>
  ),
};

// Retro form grammar: each field is a label-over-control group; the fieldset
// is a slab card whose legend sits on the border as a yellow tab; actions are
// press-into-the-page slab buttons. Same classes the kit components use.
const fieldLabel = 'text-xs font-bold uppercase tracking-wide text-text';
const control =
  'w-full rounded-md border-2 border-border bg-surface p-3 text-text ' +
  'placeholder:text-text-muted/70 transition-all duration-fast focus:shadow-card focus:outline-none';

export const FormControls: Story = {
  render: () => (
    <Page className="max-w-content-form gap-5 bg-surface p-6">
      <Form className="gap-5">
        <Fieldset className="flex flex-col gap-4 rounded-card border-2 border-border bg-surface-raised p-5 shadow-card">
          <Legend className="rounded-sm border-2 border-border-strong bg-primary px-2.5 py-0.5 text-sm font-bold text-on-primary">
            Profile
          </Legend>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Full name</Text>
            <Input placeholder="Your name" className={control} />
          </Label>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Bio</Text>
            <Textarea placeholder="A few words about you" className={`min-h-24 ${control}`} />
            <Text className="text-xs text-text-muted">Shown on your public page.</Text>
          </Label>
          <Label className="flex flex-col gap-1.5">
            <Text className={fieldLabel}>Role</Text>
            <Select value="editor" className={control}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </Label>
        </Fieldset>
        <Page className="flex-row items-center gap-3">
          <Button className="items-center rounded-md border-2 border-border-strong bg-primary px-5 py-2.5 shadow-card transition-all duration-fast hover:bg-primary-pressed active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
            <Text className="font-semibold text-on-primary">Save changes</Text>
          </Button>
          <Button
            aria-disabled
            className="items-center rounded-md border-2 border-border bg-surface-sunken px-5 py-2.5 opacity-50"
          >
            <Text className="font-semibold text-text-muted">Save changes</Text>
          </Button>
        </Page>
      </Form>
    </Page>
  ),
};

export const DataTable: Story = {
  render: () => (
    <Page className="bg-surface p-6">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="border-b-2 border-border-strong">
            <TableHeaderCell className="p-2 text-left font-semibold text-text">Item</TableHeaderCell>
            <TableHeaderCell className="p-2 text-left font-semibold text-text">Status</TableHeaderCell>
            <TableHeaderCell className="p-2 text-left font-semibold text-text">Count</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-b-2 border-border">
            <TableCell className="p-2 text-text">First item</TableCell>
            <TableCell className="p-2 text-text-muted">Active</TableCell>
            <TableCell className="p-2 text-text-muted">63</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="p-2 text-text">Second item</TableCell>
            <TableCell className="p-2 text-text-muted">Draft</TableCell>
            <TableCell className="p-2 text-text-muted">72</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Page>
  ),
};
