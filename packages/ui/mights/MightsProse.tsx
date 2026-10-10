import { Article, Heading, Link, List, ListItem, Nav, Paragraph, Section, Text } from '../html';
import { View } from '../tw';
import { MightsFigure } from './MightsFigure';

// Long-form reading layout: Newsreader body at a ~70ch measure, Mona Sans
// section headings, and a sticky contents list from 1280px up.
//
// Kit primitives render React Native Web views and text on web. Views are flex
// columns, so the old <div> flow is kept with `block`/`grid`/`flex`. Text
// resets: `my-0` drops the browser heading/paragraph margins the kit text
// brings back, `whitespace-normal` its pre-wrap, and `font-sans` its system
// font stack. List items need `list-item` to show their square marker.

export interface ProseSection {
  id: string;
  title: string;
  body: readonly (string | readonly string[])[];
  /** Optional image after the section body; omitted while src is null. */
  figure?: { src: string | null; alt: string; caption?: string };
}

export function MightsProse({ sections, updated }: { sections: readonly ProseSection[]; updated?: string }) {
  return (
    <View className="grid grid-cols-1 gap-12 xl:grid-cols-12 xl:gap-6">
      <Nav aria-label="On this page" className="hidden xl:col-span-3 xl:block">
        <View className="sticky top-24 flex flex-col gap-3 border-l border-rule-rail pl-5">
          <Text className="whitespace-normal font-sans text-label font-semibold text-text-muted">On this page</Text>
          {sections.map((s) => (
            <Link
              key={s.id}
              href={`#${s.id}`}
              className="mights-focus whitespace-normal font-sans text-ui text-text hover:text-primary"
            >
              {s.title}
            </Link>
          ))}
        </View>
      </Nav>
      <Article className="flex max-w-[70ch] flex-col gap-12 xl:col-span-8 xl:col-start-5">
        {updated ? (
          <Paragraph className="my-0 whitespace-normal font-sans text-small text-text-muted">Last updated {updated}</Paragraph>
        ) : null}
        {sections.map((s) => (
          <Section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-5 border-t border-rule-hairline pt-8">
            <Heading
              level={2}
              className="my-0 whitespace-normal font-sans text-title font-semibold text-text md:text-title-lg"
            >
              {s.title}
            </Heading>
            {s.body.map((block, i) =>
              typeof block === 'string' ? (
                <Paragraph key={i} className="my-0 whitespace-normal font-serif text-prose text-text">
                  {block}
                </Paragraph>
              ) : (
                <List key={i} className="flex flex-col gap-3 pl-5">
                  {block.map((item) => (
                    <ListItem
                      key={item}
                      className="list-item list-[square] whitespace-normal font-serif text-prose text-text marker:text-primary"
                    >
                      {item}
                    </ListItem>
                  ))}
                </List>
              ),
            )}
            {s.figure ? <MightsFigure {...s.figure} ratio="standard" className="mt-2" /> : null}
          </Section>
        ))}
      </Article>
    </View>
  );
}
