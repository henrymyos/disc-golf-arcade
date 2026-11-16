// What the menus need about each built 2026 course, without the holes (those load
// on demand from ./courses). Append only, same order as PRO_COURSES: a course's
// seed is its index here, and saved bests are keyed by seed. par / lengthFt must
// match the course file; tests/protour.test.ts checks every field.
import type { ProCourseMeta } from "./types";

export const PRO_COURSE_META: ProCourseMeta[] = [
  { id: "maple-hill", name: "Maple Hill", city: "Leicester, MA", layoutLabel: "MPO Gold · A layout · final-round pins", theme: "classic", par: 61, lengthFt: 9293 },
  { id: "brewster-ridge", name: "Brewster Ridge", city: "Smugglers' Notch, VT", layoutLabel: "MPO · the rounds 1–2 course", theme: "classic", par: 62, lengthFt: 8655 },
  { id: "idlewild", name: "Idlewild", city: "Burlington, KY", layoutLabel: "MPO · final-round pins", theme: "classic", par: 68, lengthFt: 9629 },
  { id: "winthrop-gold", name: "Winthrop Gold", city: "Rock Hill, SC", layoutLabel: "MPO · A pins", theme: "classic", par: 64, lengthFt: 9727 },
  { id: "kensington-toboggan", name: "Kensington Toboggan", city: "Milford, MI", layoutLabel: "MPO · final-round course", theme: "classic", par: 66, lengthFt: 11125 },
  { id: "fox-run-meadows", name: "Fox Run Meadows", city: "Smugglers' Notch, VT", layoutLabel: "MPO · rounds 3–4", theme: "classic", par: 64, lengthFt: 10025 },
  { id: "ivy-hill", name: "Ivy Hill", city: "Lynchburg, VA", layoutLabel: "MPO · A layout", theme: "classic", par: 67, lengthFt: 11960 },
  { id: "northwood-black", name: "Northwood Black", city: "Morton, IL", layoutLabel: "MPO", theme: "classic", par: 68, lengthFt: 10499 },
  { id: "harvey-penick", name: "Harvey Penick", city: "Austin, TX", layoutLabel: "MPO", theme: "classic", par: 63, lengthFt: 9345 },
  { id: "brighton-majestic", name: "Brighton \"Majestic\"", city: "Brighton, UT", layoutLabel: "FPO", theme: "classic", par: 62, lengthFt: 7375 },
  { id: "black-locust-south", name: "Black Locust South", city: "Milford, MI", layoutLabel: "MPO", theme: "classic", par: 65, lengthFt: 10859 },
  { id: "disc-side-of-heaven", name: "Disc Side of Heaven", city: "Jonesboro, AR", layoutLabel: "MPO", theme: "classic", par: 63, lengthFt: 9918 },
  { id: "bad-rock-creek", name: "Bad Rock Creek", city: "Liberty, MO", layoutLabel: "MPO", theme: "classic", par: 67, lengthFt: 10678 },
  { id: "pickard-park", name: "Pickard Park", city: "Indianola, IA", layoutLabel: "MPO", theme: "classic", par: 64, lengthFt: 10250 },
  { id: "olympus", name: "Olympus", city: "Brooksville, FL", layoutLabel: "MPO", theme: "classic", par: 65, lengthFt: 10178 },
  { id: "parc-des-familles", name: "Parc des Familles", city: "Jefferson Parish, LA", layoutLabel: "MPO", theme: "classic", par: 69, lengthFt: 12370 },
  { id: "hornets-nest", name: "Hornets Nest", city: "Charlotte, NC", layoutLabel: "MPO", theme: "classic", par: 62, lengthFt: 9084 },
  { id: "swenson-park-a", name: "Swenson Park A", city: "Stockton, CA", layoutLabel: "MPO", theme: "classic", par: 65, lengthFt: 10950 },
  { id: "milo-mciver", name: "Milo McIver", city: "Estacada, OR", layoutLabel: "MPO", theme: "classic", par: 62, lengthFt: 9823 },
  { id: "the-preserve", name: "The Preserve", city: "Clearwater, MN", layoutLabel: "MPO · A pins", theme: "classic", par: 65, lengthFt: 10881 },
  { id: "ymergarden", name: "Ymergården", city: "Borås, Sweden", layoutLabel: "MPO", theme: "classic", par: 61, lengthFt: 8291 },
  { id: "ale-dgc", name: "Ale Disc Golf Center", city: "Nol, Sweden", layoutLabel: "MPO", theme: "classic", par: 63, lengthFt: 9782 },
  { id: "kippasuo", name: "Kippis", city: "Heinola, Finland", layoutLabel: "MPO", theme: "classic", par: 62, lengthFt: 8850 },
  { id: "swenson-park-b", name: "Swenson Park B", city: "Stockton, CA", layoutLabel: "MPO", theme: "classic", par: 66, lengthFt: 10993 },
  { id: "sprinkle-valley", name: "Sprinkle Valley", city: "Austin, TX", layoutLabel: "MPO", theme: "classic", par: 66, lengthFt: 9166 },
  { id: "eureka-lake", name: "Eureka Lake", city: "Eureka, IL", layoutLabel: "MPO", theme: "classic", par: 63, lengthFt: 9819 },
  { id: "sunset-hills", name: "Sunset Hills", city: "Pekin, IL", layoutLabel: "FPO", theme: "classic", par: 61, lengthFt: 7602 },
  { id: "glendoveer-east", name: "Glendoveer East", city: "Portland, OR", layoutLabel: "MPO", theme: "classic", par: 66, lengthFt: 11530 },
];
