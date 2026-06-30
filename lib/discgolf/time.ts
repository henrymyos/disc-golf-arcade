// ── Recurring-content clock. The Daily Reward, the Daily Challenge, and the
// weekly challenges all roll over on US Central Time (America/Chicago, DST-aware):
// a new day starts at midnight Central, and a new week starts at midnight Central
// on Sunday. These helpers map real epoch-ms timestamps to Central-aligned day/week
// indices (stable integers used as seeds + claim keys) and back to the exact
// [start, end) UTC range a day/week spans — needed to window saved round history,
// whose `date`s are plain UTC epoch ms. Pure + dependency-free (Intl handles DST). ──

const TZ = "America/Chicago";
const DAY_MS = 86_400_000;
// Day index 0 is 1970-01-01 (a Thursday); the first Sunday on/after the epoch is
// 1970-01-04, day index 3 — so Central Sunday day indices are 3, 10, 17, … (≡3 mod 7).
const FIRST_SUNDAY_DAY = 3;

// The wall-clock offset of Central from UTC at `instant`, in ms (negative: −6h CST /
// −5h CDT). Derived via Intl so daylight saving is handled without a tz database.
function tzOffsetMs(instant: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const f = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUTC = Date.UTC(f("year"), f("month") - 1, f("day"), f("hour") % 24, f("minute"), f("second"));
  return asUTC - instant;
}

// The civil date in Central at `instant`, as { y, m (0-based), d }.
function centralYMD(instant: number): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const f = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: f("year"), m: f("month") - 1, d: f("day") };
}

// The UTC instant of the Central midnight that begins civil date y-m-d. Corrects
// for a DST transition near the boundary (the offset can differ either side of it).
function centralMidnightUTC(y: number, m: number, d: number): number {
  const naive = Date.UTC(y, m, d, 0, 0, 0); // pretend Central midnight were UTC midnight
  const o1 = tzOffsetMs(naive);
  let t = naive - o1;
  const o2 = tzOffsetMs(t);
  if (o2 !== o1) t = naive - o2;
  return t;
}

// Index of the Central calendar day containing `now` (flips at midnight Central).
// Encoded as the day count of the Central civil date, so it round-trips cleanly
// with centralDayRange.
export function centralDay(now: number): number {
  const { y, m, d } = centralYMD(now);
  return Math.floor(Date.UTC(y, m, d) / DAY_MS);
}

// The [start, end) UTC ms span of Central day `day`.
export function centralDayRange(day: number): { start: number; end: number } {
  const a = new Date(day * DAY_MS);       // decode the civil date back out of the index
  const b = new Date((day + 1) * DAY_MS);
  return {
    start: centralMidnightUTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()),
    end: centralMidnightUTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()),
  };
}

// Index of the Central week (Sunday-anchored) that contains Central day `day`.
export function centralWeekFromDay(day: number): number {
  const dow = new Date(day * DAY_MS).getUTCDay(); // 0=Sun … 6=Sat for the civil date
  const sunday = day - dow;                        // Central day index of this week's Sunday
  return Math.round((sunday - FIRST_SUNDAY_DAY) / 7);
}

// Index of the Central week containing `now` (flips at midnight Central on Sunday).
export function centralWeek(now: number): number {
  return centralWeekFromDay(centralDay(now));
}

// The [start, end) UTC ms span of Central week `week` (Sun 00:00 → next Sun 00:00).
export function centralWeekRange(week: number): { start: number; end: number } {
  const sunday = FIRST_SUNDAY_DAY + week * 7;
  return { start: centralDayRange(sunday).start, end: centralDayRange(sunday + 7).start };
}

// Index of the Central calendar month containing `now` (flips at midnight Central
// on the 1st). Monotonic — y·12 + m — so consecutive months differ by exactly 1.
// Used to give Ranked a fresh season each month.
export function centralMonth(now: number): number {
  const { y, m } = centralYMD(now);
  return y * 12 + m;
}

// A human label for a Central month index, e.g. "June 2026".
export function centralMonthLabel(month: number): string {
  const y = Math.floor(month / 12), m = ((month % 12) + 12) % 12;
  return new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
