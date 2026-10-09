/**
 * A dated moment from Harlem's past, shown at the top of Today. Every entry
 * cites the article its date was checked against (2026-10-09); add new ones
 * the same way — a date the source states outright, never an inferred one.
 */
export interface HarlemHistoryFact {
  /** ISO date of the event, `YYYY-MM-DD`. */
  date: string;
  /** One sentence, past tense, naming the place. */
  text: string;
  sourceLabel: string;
  sourceUrl: string;
}

export const HARLEM_HISTORY_FACTS: readonly HarlemHistoryFact[] = [
  {
    date: '1934-01-26',
    text: 'The Apollo reopened on West 125th Street as the 125th Street Apollo Theatre, programmed for Harlem’s Black audience.',
    sourceLabel: 'Wikipedia: Apollo Theater',
    sourceUrl: 'https://en.wikipedia.org/wiki/Apollo_Theater',
  },
  {
    date: '1926-03-12',
    text: 'The Savoy Ballroom opened on Lenox Avenue. It ran until July 10, 1958.',
    sourceLabel: 'Wikipedia: Savoy Ballroom',
    sourceUrl: 'https://en.wikipedia.org/wiki/Savoy_Ballroom',
  },
  {
    date: '1935-03-19',
    text: 'The Harlem riot of 1935 broke out.',
    sourceLabel: 'Wikipedia: Harlem riot of 1935',
    sourceUrl: 'https://en.wikipedia.org/wiki/Harlem_riot_of_1935',
  },
  {
    date: '1943-08-01',
    text: 'The Harlem riot of 1943 began after a white police officer, James Collins, shot a man. It ran into August 2.',
    sourceLabel: 'Wikipedia: Harlem riot of 1943',
    sourceUrl: 'https://en.wikipedia.org/wiki/Harlem_riot_of_1943',
  },
  {
    date: '1958-09-20',
    text: 'Martin Luther King Jr. was stabbed at a book signing in Harlem, and survived.',
    sourceLabel: 'Wikipedia: Izola Curry',
    sourceUrl: 'https://en.wikipedia.org/wiki/Izola_Curry',
  },
  {
    date: '1934-11-21',
    text: 'Ella Fitzgerald, 17, debuted at one of the first Amateur Nights at the Apollo Theater.',
    sourceLabel: 'Wikipedia: Ella Fitzgerald',
    sourceUrl: 'https://en.wikipedia.org/wiki/Ella_Fitzgerald',
  },
];

const dayOfYear = (monthDay: string): number => {
  const [m, d] = monthDay.split('-').map(Number);
  return Math.round((Date.UTC(2001, (m ?? 1) - 1, d ?? 1) - Date.UTC(2001, 0, 1)) / 86_400_000);
};

/**
 * The fact for a Harlem calendar day: the one on that month and day if it
 * exists, otherwise the one nearest on the calendar (either side, wrapping
 * the year). `onThisDay` says which.
 *
 * @param dateInNY `YYYY-MM-DD` in America/New_York (see `harlemToday()`).
 */
export function harlemHistoryFactFor(dateInNY: string): { fact: HarlemHistoryFact; onThisDay: boolean } {
  const today = dayOfYear(dateInNY.slice(5));
  let best = HARLEM_HISTORY_FACTS[0]!;
  let bestGap = Infinity;
  for (const fact of HARLEM_HISTORY_FACTS) {
    const raw = Math.abs(dayOfYear(fact.date.slice(5)) - today);
    const gap = Math.min(raw, 365 - raw);
    if (gap < bestGap) {
      best = fact;
      bestGap = gap;
    }
  }
  return { fact: best, onThisDay: bestGap === 0 };
}
