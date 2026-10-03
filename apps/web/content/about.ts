import type { ProseSection } from '@acme/ui/mights';

export const ABOUT_LEAD =
  'Harlem Might is a map of Harlem that keeps the story of every place attached to the place itself, from the corner restaurant to the theater that changed American music.';

export const ABOUT_SECTIONS: readonly ProseSection[] = [
  {
    id: 'name',
    title: 'The name',
    body: [
      'Say it out loud: Harlem Might. It sounds like Harlemite, the word for someone from Harlem. A Harlemite is the person who knows which bakery sells out by noon, which block throws the best summer cookout, and whose grandmother remembers when the club on the corner had a different name.',
      'That is who this guide is written for and, as much as possible, who it is written by. The knowledge on these pages belongs to the neighborhood first.',
      'The second half of the name is deliberate too. Might means strength: the strength it took to build Harlem, to hold onto it, and to keep making culture that the rest of the world borrows. The crown in the logo sits over a skyline of brownstones for the same reason. The power is in the blocks and the people on them.',
      'Harlem Might is a guide by Harlemites, for anyone who wants to see the neighborhood the way they do.',
    ],
  },
  {
    id: 'why',
    title: 'Why we built it',
    body: [
      'Most maps answer one question: what is here? Harlem deserves more than that. A block on Lenox Avenue can hold a soul food kitchen, a church that anchored a movement, a building where a poet once lived, and a mural painted last summer. Generic map apps flatten all of that into a pin and a star rating.',
      'Harlem Might starts from the opposite direction. Every place on the map carries the reasons it matters: what happened there, who is connected to it, what the block looked like before, and what is happening there today. The map is how you find a place. The record behind it is why you go.',
      'We want a visitor planning their first walk, a teacher building a field trip, and someone who has lived on the same street for forty years to each find something true and useful in the same place.',
    ],
  },
  {
    id: 'what',
    title: 'What you will find here',
    body: [
      'Harlem Might covers the whole life of the neighborhood, not just its landmarks:',
      [
        'Culture: theaters, museums, galleries, archives and performance spaces.',
        'Food and drink: the restaurants, cafés, bakeries and bars that feed the neighborhood.',
        'Music and nightlife: active venues, and the rooms where history was made even if the doors have since closed.',
        'Parks and public space: gardens, monuments, public art and the places people gather.',
        'Architecture: brownstone rows, historic districts and the details worth looking up from the sidewalk to notice.',
        'Faith and community: the churches, mosques and institutions that carried Harlem through every era.',
      ],
      'Walks connect places into routes, stories carry the deeper history, and Today shows what is on right now. All of it points back to the same place records, so a story, a walk stop and a map pin about the same building never disagree.',
    ],
  },
  {
    id: 'one-place',
    title: 'One place, one record',
    body: [
      'Each place in Harlem Might has exactly one record, and that record powers everything: the pin on the map, the detail page, walking directions, a stop on a walk, a story, and the label you see through your phone in AR. We do not keep a separate copy for the app, another for the website and another for AR. When a record is corrected, it is corrected everywhere at once.',
      'That single record is also where we keep the parts other maps leave out: the real entrance rather than the middle of the roof, an accessible entrance where one exists, and the best public spot to stand if you want to see a façade properly.',
    ],
  },
  {
    id: 'history',
    title: 'Places that closed still count',
    body: [
      'A place does not disappear from Harlem Might because it closed. Some of the most important rooms in Harlem history are now something else entirely. When a venue is gone, its record stays, marked as historical, with its former names, dates, the people connected to it and the stories told about it, alongside what stands at that address today.',
      'We think this is one of the most important things a Harlem map can do. The neighborhood is layered, and the layers are the point.',
    ],
  },
  {
    id: 'method',
    title: 'How we research a place',
    body: [
      'Harlem Might keeps its own catalogue of places rather than relying on a commercial listings service. Outside sources are treated as evidence, not as the final word. Every record is built in the same order:',
      [
        'Find it. A place enters the catalogue from local knowledge, archival research or a public dataset.',
        'Locate it. We fix one location for it, and where it matters, the real entrance.',
        'Source it. Every fact is attached to where it came from. A claim without a source does not go on the page.',
        'Review it. New information from an outside source is compared against the record by a person before anything changes. No automated feed is allowed to overwrite a record on its own.',
        'Keep it current. Hours, events and status are checked again over time, and stale information is flagged rather than left to rot.',
      ],
    ],
  },
  {
    id: 'sources',
    title: 'Where the facts come from',
    body: [
      'Our research draws on public collections and open data, including the Schomburg Center for Research in Black Culture, NYPL Digital Collections, the Library of Congress, NYC Open Data, OpenStreetMap and Wikidata, along with official websites and local knowledge from people who know the blocks best.',
      'Naming a source means we use what it makes publicly available. It does not mean that institution has partnered with or endorsed Harlem Might.',
      'Locations on the map come from OpenStreetMap, and the maps themselves are drawn by Mapbox. Historical images are used only when their rights are cleared, and every one is credited with its source and date.',
    ],
  },
  {
    id: 'images',
    title: 'About the images',
    body: [
      'Some images on this site are generated for Harlem Might to set the scene. They are always captioned as generated images, and they never stand in for a photograph of a specific real place or a real person. Documentary photographs and archival images carry their own credit lines with source and date.',
    ],
  },
  {
    id: 'corrections',
    title: 'Corrections',
    body: [
      'If something on Harlem Might is wrong, we want to know. That includes a wrong opening time, a misplaced pin, a date that does not match the record, or a story that leaves out something important.',
      'A dedicated corrections address is being set up and will be listed here. When a correction is confirmed, the record is fixed once and the change appears everywhere that place is shown.',
    ],
  },
];
