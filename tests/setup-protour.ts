// Every test runs with the Pro Tour hole data loaded, as the app does once a
// Pro Tour round can start (the data itself loads on demand; see engine loadProTour).
import { loadProTour } from "../lib/discgolf/engine";

await loadProTour();
