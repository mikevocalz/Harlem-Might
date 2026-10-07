import { MightsFigure } from './MightsFigure';

// Long-form reading layout: Newsreader body at a ~70ch measure, Mona Sans
// section headings, and a sticky contents list from 1280px up.

export interface ProseSection {
  id: string;
  title: string;
  body: readonly (string | readonly string[])[];
  /** Optional image after the section body; omitted while src is null. */
  figure?: { src: string | null; alt: string; caption?: string };
}

export function MightsProse({ sections, updated }: { sections: readonly ProseSection[]; updated?: string }) {
  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-12 xl:gap-6">
      <nav aria-label="On this page" className="hidden xl:col-span-3 xl:block">
        <div className="sticky top-24 flex flex-col gap-3 border-l border-rule-rail pl-5">
          <span className="text-label font-semibold text-text-muted">On this page</span>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="mights-focus text-ui text-text hover:text-primary">
              {s.title}
            </a>
          ))}
        </div>
      </nav>
      <article className="flex max-w-[70ch] flex-col gap-12 xl:col-span-8 xl:col-start-5">
        {updated ? <p className="text-small text-text-muted">Last updated {updated}</p> : null}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-24 flex-col gap-5 border-t border-rule-hairline pt-8">
            <h2 className="font-sans text-title font-semibold text-text md:text-title-lg">{s.title}</h2>
            {s.body.map((block, i) =>
              typeof block === 'string' ? (
                <p key={i} className="font-serif text-prose text-text">
                  {block}
                </p>
              ) : (
                <ul key={i} className="flex flex-col gap-3 pl-5">
                  {block.map((item) => (
                    <li key={item} className="list-[square] font-serif text-prose text-text marker:text-primary">
                      {item}
                    </li>
                  ))}
                </ul>
              ),
            )}
            {s.figure ? <MightsFigure {...s.figure} ratio="standard" className="mt-2" /> : null}
          </section>
        ))}
      </article>
    </div>
  );
}
