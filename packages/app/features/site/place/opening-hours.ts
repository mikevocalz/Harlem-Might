// Reads the common subset of OpenStreetMap `opening_hours` values into a
// weekly table: `Mo-Fr 09:00-17:00; Sa,Su 10:00-16:00`, `24/7`,
// `Su off`, split ranges (`11:00-15:00,17:00-22:00`) and ranges past
// midnight (`18:00-02:00`). Anything else (PH, month ranges, week numbers,
// comments) returns null and the page shows the source string as written.

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** Minutes from midnight; `end` may pass 1440 for a range that runs past midnight. */
export interface HoursRange {
  start: number;
  end: number;
}

/** One entry per weekday, Monday first. An empty array means closed that day. */
export type WeeklyHours = HoursRange[][];

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : null;
};

function parseDays(selector: string): number[] | null {
  const days = new Set<number>();
  for (const part of selector.split(',')) {
    const [from, to] = part.split('-');
    const a = OSM_DAYS.indexOf(from as (typeof OSM_DAYS)[number]);
    if (a < 0) return null;
    if (to === undefined) {
      days.add(a);
      continue;
    }
    const b = OSM_DAYS.indexOf(to as (typeof OSM_DAYS)[number]);
    if (b < 0) return null;
    // Wrapping ranges like Fr-Mo are valid OSM.
    for (let d = a; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === b) break;
    }
  }
  return [...days];
}

function parseTimes(spec: string): HoursRange[] | null {
  const ranges: HoursRange[] = [];
  for (const part of spec.split(',')) {
    const [from, to] = part.split('-');
    if (from === undefined || to === undefined) return null;
    const start = toMinutes(from);
    let end = toMinutes(to);
    if (start === null || end === null) return null;
    if (end <= start) end += 24 * 60;
    ranges.push({ start, end });
  }
  return ranges;
}

// "Mo-Th 11:00-23:00, Fr-Sa 11:00-24:00" → two rules, but "Mo-Th, Sa 09:00"
// stays one: a `, ` only starts a new rule once the current one has a time.
function splitCommaRules(rule: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const piece of rule.split(/,\s+/)) {
    if (current && /\d|off|closed/.test(current) && /^[A-Z][a-z]/.test(piece)) {
      out.push(current);
      current = piece;
    } else {
      current = current ? `${current},${piece}` : piece;
    }
  }
  if (current) out.push(current);
  return out;
}

/** The weekly table for an OSM `opening_hours` value, or null when it uses syntax outside the subset above. */
export function parseOpeningHours(osm: string): WeeklyHours | null {
  const week: WeeklyHours = WEEKDAYS.map(() => []);
  // `;` separates rules; mappers also write `, ` before a new day selector
  // ("Mo-Th 11:00-23:00, Fr-Sa 11:00-24:00"), which is read the same way.
  const rules = osm
    .split(';')
    .flatMap(splitCommaRules)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rules.length === 0) return null;
  for (const rule of rules) {
    if (rule === '24/7') {
      for (let d = 0; d < 7; d++) week[d] = [{ start: 0, end: 24 * 60 }];
      continue;
    }
    // The day selector is everything before the first time or off/closed
    // token; "Mo-Th, Sa" may carry spaces after its commas.
    const split = /\s(?=\d|off\b|closed\b)/.exec(rule);
    const hasDays = /^[A-Z][a-z]/.test(rule);
    if (hasDays && !split) return null;
    const days = hasDays ? parseDays(rule.slice(0, split!.index).replace(/\s+/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    const spec = (hasDays ? rule.slice(split!.index) : rule).replace(/\s+/g, '');
    if (!days) return null;
    if (spec === 'off' || spec === 'closed') {
      for (const d of days) week[d] = [];
      continue;
    }
    const times = parseTimes(spec);
    if (!times) return null;
    // A later rule for the same day replaces the earlier one (OSM semantics).
    for (const d of days) week[d] = times;
  }
  return week;
}

/** Monday-first weekday index and minutes from midnight for an instant in New York. */
export function harlemClock(now: Date): { day: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday ?? '');
  return { day, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Whether the table says the place is open at `day`/`minute`, counting yesterday's past-midnight ranges. */
export function isOpenAt(week: WeeklyHours, day: number, minute: number): boolean {
  const today = week[day] ?? [];
  if (today.some((r) => minute >= r.start && minute < r.end)) return true;
  const yesterday = week[(day + 6) % 7] ?? [];
  return yesterday.some((r) => r.end > 24 * 60 && minute < r.end - 24 * 60);
}

/** "9 AM", "5:30 PM", "Midnight". */
export function formatMinute(total: number): string {
  const m = total % (24 * 60);
  if (m === 0) return 'Midnight';
  const h = Math.floor(m / 60);
  const min = m % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/** One weekday's hours as a line: "9 AM – 5 PM", "Open 24 hours", "Closed". */
export function formatDay(ranges: readonly HoursRange[]): string {
  if (ranges.length === 0) return 'Closed';
  const [only] = ranges;
  if (ranges.length === 1 && only && only.start === 0 && only.end === 24 * 60) return 'Open 24 hours';
  return ranges.map((r) => `${formatMinute(r.start)} – ${formatMinute(r.end)}`).join(', ');
}
