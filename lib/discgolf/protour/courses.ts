// The full hole data of every built 2026 course. Loaded on demand (engine
// loadProTour) so ~50 KB of course data stays off the menu's critical path.
// Append only, in the same order as PRO_COURSE_META (./meta): seeds come from the
// index. tests/protour.test.ts checks the two lists match.
import type { ProCourse } from "./types";
import { MAPLE_HILL } from "./maple-hill";
import { BREWSTER_RIDGE } from "./brewster-ridge";
import { IDLEWILD } from "./idlewild";
import { WINTHROP_GOLD } from "./winthrop-gold";
import { KENSINGTON_TOBOGGAN } from "./kensington-toboggan";
import { FOX_RUN_MEADOWS } from "./fox-run-meadows";
import { IVY_HILL } from "./ivy-hill";
import { NORTHWOOD_BLACK } from "./northwood-black";
import { HARVEY_PENICK } from "./harvey-penick";
import { BRIGHTON_MAJESTIC } from "./brighton-majestic";
import { BLACK_LOCUST_SOUTH } from "./black-locust-south";
import { DISC_SIDE_OF_HEAVEN } from "./disc-side-of-heaven";
import { BAD_ROCK_CREEK } from "./bad-rock-creek";
import { PICKARD_PARK } from "./pickard-park";
import { OLYMPUS } from "./olympus";
import { PARC_DES_FAMILLES } from "./parc-des-familles";
import { HORNETS_NEST } from "./hornets-nest";
import { SWENSON_PARK_A } from "./swenson-park-a";
import { MILO_MCIVER } from "./milo-mciver";
import { THE_PRESERVE } from "./the-preserve";
import { YMERGARDEN } from "./ymergarden";
import { ALE_DGC } from "./ale-dgc";
import { KIPPIS } from "./kippis";
import { SWENSON_PARK_B } from "./swenson-park-b";
import { SPRINKLE_VALLEY } from "./sprinkle-valley";
import { EUREKA_LAKE } from "./eureka-lake";
import { SUNSET_HILLS } from "./sunset-hills";
import { GLENDOVEER_EAST } from "./glendoveer-east";

export const PRO_COURSES: ProCourse[] = [MAPLE_HILL, BREWSTER_RIDGE, IDLEWILD, WINTHROP_GOLD, KENSINGTON_TOBOGGAN, FOX_RUN_MEADOWS, IVY_HILL, NORTHWOOD_BLACK, HARVEY_PENICK, BRIGHTON_MAJESTIC, BLACK_LOCUST_SOUTH, DISC_SIDE_OF_HEAVEN, BAD_ROCK_CREEK, PICKARD_PARK, OLYMPUS, PARC_DES_FAMILLES, HORNETS_NEST, SWENSON_PARK_A, MILO_MCIVER, THE_PRESERVE, YMERGARDEN, ALE_DGC, KIPPIS, SWENSON_PARK_B, SPRINKLE_VALLEY, EUREKA_LAKE, SUNSET_HILLS, GLENDOVEER_EAST];
