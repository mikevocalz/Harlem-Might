import type { ProseSection } from '@acme/ui/mights';

export const PRESS_BOILERPLATE =
  'Harlem Might is a map of Harlem that keeps the story of every place attached to the place itself. It brings the neighborhood’s culture, food, music, parks, architecture and history together on one map on the web. An app for iPhone and Android is built but not released, and an augmented-reality view for the sidewalk is a concept with no code behind it yet.';

export const PRESS_SECTIONS: readonly ProseSection[] = [
  {
    id: 'story',
    title: 'The story',
    body: [
      'Harlem Might began with a simple frustration: maps tell you what is on a block but almost never why it matters. Harlem is one of the most storied neighborhoods in the world, and its history is not in a museum somewhere else. It is on the corners, in the brownstones and behind the marquees.',
      'The name is a play on Harlemite, the word for someone from Harlem. It is a guide written from the neighborhood out, with might standing for the strength of Harlem and the people who built it.',
      'Harlem Might gives every place one record that carries its history, its people and what is happening there today, and uses that same record across the map, walking routes and long-form stories. An augmented-reality view that labels the building in front of you would read from the same record; for now that view is a concept.',
    ],
  },
  {
    id: 'facts',
    title: 'Fact sheet',
    body: [
      [
        'Name: Harlem Might, a play on Harlemite, the word for a Harlem native. Might stands for the strength of the neighborhood and its people, which is why the logo wears a crown.',
        'What it is: a map and guide to Harlem, New York, with place histories, walks, stories and listings.',
        'Where: on the web now. The app for iPhone and Android builds but has not been released, and it is not in the App Store or Google Play.',
        'Coverage: Harlem, starting with Central Harlem and expanding block by block.',
        'Approach: a first-party catalogue of places, researched and sourced, with one record per place across every experience.',
        'Price: the website is free to use.',
      ],
    ],
  },
  {
    id: 'differences',
    title: 'What makes it different',
    body: [
      [
        'History stays on the map. Places that have closed keep their records, marked as historical, so the layers of the neighborhood are never erased.',
        'Every fact has a source. Outside data is treated as evidence and reviewed by a person before it changes a record.',
        'One record everywhere. The map pin, the detail page and the walk stop all come from the same place record, and the AR label we are designing would too.',
        'Built for the sidewalk. Each record has room for a sourced entrance, not just a dot on a roof, and stays blank until one is checked.',
      ],
    ],
  },
  {
    id: 'assets',
    title: 'Logo and assets',
    body: [
      'The Harlem Might logo is available below in landscape and portrait versions with transparent backgrounds. Please use the logo as supplied: do not recolor it, stretch it, add effects or place it on a busy background. On dark backgrounds the gold logo can be used as is.',
      'A full press kit with credited photography is in preparation.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    body: [
      'A press contact address is being set up and will be listed here. Until then, this page and the About page are the authoritative description of Harlem Might.',
    ],
  },
];
