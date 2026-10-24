// The real 2026 season, in schedule order: 18 DGPT events and 5 PDGA Majors
// (23 stops). Event names drop sponsor prefixes and the UI shows no logos or
// tour marks. Schedule and tiers: dgpt.com/announcements/2026-schedule; course
// names: dgpt.com/schedule; Worlds courses: detroit26.com/courses. PDGA links
// were copied from each event's DGPT page (nothing is fetched from pdga.com).
//
// `built` marks a course that's playable in the game: the pilot courses plus
// waves 1–4 (wave 4 shipped out of band by Henry's choice, Oct 24); the rest list as "Coming later".

export type ProTier = "Elite" | "Elite+" | "Playoffs" | "Major";
export type ProStopCourse = { id: string; name: string; built: boolean };
export type ProStop = {
  stop: number;
  event: string;
  tier: ProTier;
  dates: string;
  city: string;
  pdgaEventUrl: string;
  courses: ProStopCourse[]; // multi-course events list the final-round course last
};

const pdga = (id: number) => `https://www.pdga.com/tour/event/${id}`;
const c = (id: string, name: string, built = false): ProStopCourse => ({ id, name, built });

export const SEASON_2026: ProStop[] = [
  { stop: 1, event: "Supreme Flight Open", tier: "Elite", dates: "Feb 27–Mar 1", city: "Brooksville, FL", pdgaEventUrl: pdga(96401), courses: [c("olympus", "Olympus")] },
  { stop: 2, event: "Big Easy Open", tier: "Elite", dates: "Mar 13–15", city: "Jefferson Parish, LA", pdgaEventUrl: pdga(96402), courses: [c("parc-des-familles", "Parc des Familles")] },
  { stop: 3, event: "Queen City Classic", tier: "Elite", dates: "Mar 27–29", city: "Charlotte, NC", pdgaEventUrl: pdga(96403), courses: [c("hornets-nest", "Hornets Nest")] },
  { stop: 4, event: "Champions Cup", tier: "Major", dates: "Apr 9–12", city: "Lynchburg, VA", pdgaEventUrl: pdga(97336), courses: [c("new-london-tech", "New London Tech")] },
  // Wave 4 (Disc Side of Heaven, Bad Rock Creek, Pickard Park) sits outside the ±1.5 balance band;
  // Henry chose to ship it as the real courses play anyway (Oct 24), overriding the hold rule.
  { stop: 5, event: "Jonesboro Open", tier: "Elite", dates: "Apr 17–19", city: "Jonesboro, AR", pdgaEventUrl: pdga(96404), courses: [c("disc-side-of-heaven", "Disc Side of Heaven", true)] },
  { stop: 6, event: "Kansas City Wide Open", tier: "Elite", dates: "Apr 24–26", city: "Liberty, MO", pdgaEventUrl: pdga(96407), courses: [c("bad-rock-creek", "Bad Rock Creek", true)] },
  { stop: 7, event: "Open at Austin", tier: "Elite+", dates: "May 7–10", city: "Austin, TX", pdgaEventUrl: pdga(96408), courses: [c("harvey-penick", "Harvey Penick", true), c("sprinkle-valley", "Sprinkle Valley")] },
  { stop: 8, event: "OTB Open", tier: "Elite+", dates: "May 21–24", city: "Stockton, CA", pdgaEventUrl: pdga(96409), courses: [c("swenson-park-a", "Swenson Park A"), c("swenson-park-b", "Swenson Park B")] },
  { stop: 9, event: "Northwest Championship", tier: "Elite+", dates: "Jun 4–7", city: "Portland, OR", pdgaEventUrl: pdga(96410), courses: [c("milo-mciver", "Milo McIver"), c("glendoveer-east", "Glendoveer East")] },
  { stop: 10, event: "European Open", tier: "Major", dates: "Jun 18–21", city: "Tallinn, Estonia", pdgaEventUrl: pdga(97339), courses: [c("song-festival-grounds", "Song Festival Grounds")] },
  { stop: 11, event: "Swedish Open", tier: "Elite", dates: "Jun 26–28", city: "Borås, Sweden", pdgaEventUrl: pdga(96411), courses: [c("ymergarden", "Ymergården")] },
  { stop: 12, event: "Ale Open", tier: "Elite", dates: "Jul 3–5", city: "Nol, Sweden", pdgaEventUrl: pdga(96412), courses: [c("ale-dgc", "Ale Disc Golf Center")] },
  { stop: 13, event: "Heinola Open", tier: "Elite", dates: "Jul 10–12", city: "Heinola, Finland", pdgaEventUrl: pdga(96413), courses: [c("kippasuo", "Kippasuo")] },
  // Brighton held (Henry, Oct 18): its FPO-only layout plays ~14 strokes too easy; course data stays in PRO_COURSES.
  { stop: 14, event: "US Women's Disc Golf Championship", tier: "Major", dates: "Jul 16–19", city: "Lehi, UT", pdgaEventUrl: pdga(97341), courses: [c("brighton-majestic", "Brighton \"Majestic\""), c("dragonfly", "Dragonfly")] },
  { stop: 15, event: "Ledgestone Open", tier: "Elite+", dates: "Jul 30–Aug 2", city: "Peoria, IL", pdgaEventUrl: pdga(96414), courses: [c("eureka-lake", "Eureka Lake"), c("sunset-hills", "Sunset Hills"), c("northwood-black", "Northwood Black", true)] },
  { stop: 16, event: "Discmania Challenge", tier: "Elite", dates: "Aug 7–9", city: "Indianola, IA", pdgaEventUrl: pdga(96415), courses: [c("pickard-park", "Pickard Park", true)] },
  { stop: 17, event: "Doubles Championship at the Preserve", tier: "Elite", dates: "Aug 14–16", city: "Clearwater, MN", pdgaEventUrl: pdga(96416), courses: [c("the-preserve", "The Preserve")] },
  { stop: 18, event: "Pro World Championships", tier: "Major", dates: "Aug 26–30", city: "Milford, MI", pdgaEventUrl: pdga(97344), courses: [c("black-locust-south", "Black Locust South", true), c("kensington-toboggan", "Kensington Toboggan", true)] },
  { stop: 19, event: "LWS Open at Idlewild", tier: "Elite", dates: "Sep 4–6", city: "Burlington, KY", pdgaEventUrl: pdga(96417), courses: [c("idlewild", "Idlewild", true)] },
  { stop: 20, event: "Green Mountain Championship", tier: "Playoffs", dates: "Sep 17–20", city: "Smugglers' Notch, VT", pdgaEventUrl: pdga(96418), courses: [c("brewster-ridge", "Brewster Ridge", true), c("fox-run-meadows", "Fox Run Meadows", true)] },
  { stop: 21, event: "MVP Open", tier: "Playoffs", dates: "Sep 24–27", city: "Leicester, MA", pdgaEventUrl: pdga(96419), courses: [c("maple-hill", "Maple Hill", true)] },
  { stop: 22, event: "United States Disc Golf Championship", tier: "Major", dates: "Oct 8–11", city: "Rock Hill, SC", pdgaEventUrl: pdga(97346), courses: [c("winthrop-gold", "Winthrop Gold", true)] },
  // The tour championship's DGPT page lists no PDGA event page, so this links the DGPT event page.
  { stop: 23, event: "Powerball Cup", tier: "Playoffs", dates: "Oct 15–18", city: "Lynchburg, VA", pdgaEventUrl: "https://www.dgpt.com/event/2026-powerball-cup/", courses: [c("ivy-hill", "Ivy Hill", true)] },
];

// Every course in the season, built or not, and the playable ones.
export const SEASON_COURSES: ProStopCourse[] = SEASON_2026.flatMap((s) => s.courses);
export const BUILT_COURSE_IDS: string[] = SEASON_COURSES.filter((x) => x.built).map((x) => x.id);
