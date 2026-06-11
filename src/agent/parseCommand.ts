import type {
  ConfigPatch,
  DoorKey,
  EnvironmentId,
  InteriorColorId,
  PaintId,
  ViewName,
} from "../state/store";
import { ENVIRONMENTS, INTERIOR_COLORS, INTERIOR_MATERIALS, PAINTS } from "../state/palette";

/* ------------------------------------------------------------------ */
/* Stand-in for the future voice agent: lightweight keyword parsing    */
/* that converts free text into structured CarConfig patches. The      */
/* real product swaps this file for an LLM/voice pipeline emitting     */
/* the exact same ConfigPatch objects.                                 */
/* ------------------------------------------------------------------ */

export interface ParsedCommand {
  patch: ConfigPatch;
  /** human-readable confirmations, e.g. "Colour → Soul Red Crystal" */
  labels: string[];
  /** side effects that are actions rather than config: assembly restart, booking */
  actions: ("assemble" | "book" | "drive" | "park")[];
}

const COLOR_WORDS: [RegExp, PaintId][] = [
  [/\b(soul|red|crimson|scarlet)\b/, "soulRed"],
  [/\b(machine|grey|gray|silver|graphite)\b/, "machineGrey"],
  [/\b(white|pearl|snow)\b/, "snowWhite"],
  [/\b(blue|navy|ocean)\b/, "crystalBlue"],
  [/\b(black|jet|dark)\b/, "jetBlack"],
  [/\b(sand|zircon|beige|tan|champagne|gold)\b/, "zirconSand"],
];

const VIEW_WORDS: [RegExp, ViewName][] = [
  [/\b(trunk|boot|cargo|luggage)\b/, "trunk"],
  [/\b(interior|inside|cabin|cockpit|dash|dashboard|seats?)\b/, "interior"],
  [/\b(wheels?|rims?|tires?|tyres?|alloys?)\b/, "wheels"],
  [/\b(front|face|grille|nose)\b/, "front"],
  [/\b(rear|back|behind|tail)\b/, "rear"],
  [/\b(exterior|outside|overview|around|profile)\b/, "exterior"],
];

const ENV_WORDS: [RegExp, EnvironmentId][] = [
  [/\b(mountains?|alps|alpine|hik\w+|trails?|off-?road|forest|nature|camping?)\b/, "mountain"],
  [/\b(city|urban|downtown|town|commut\w+|streets?|metropolis)\b/, "city"],
  [/\b(coast(?:al)?(?:\s+road)?|beach|seaside|ocean\s+road|riviera|surf\w*)\b/, "coast"],
  [/\b(studio|showroom)\b/, "studio"],
];

const INTERIOR_COLOR_WORDS: [string, InteriorColorId][] = [
  ["black|charcoal|obsidian", "obsidian"],
  ["cognac|brown|caramel|chestnut", "cognac"],
  ["tan|saddle", "tan"],
  ["greige|grey|gray|stone|beige|cream|parchment", "greige"],
];
const CABIN_CTX =
  "interior|cabin|inside|seats?|upholstery|leather(?:ette)?|nappa|cloth|fabric|suede";

const DOOR_LABELS: Record<DoorKey, string> = {
  frontLeft: "Driver door",
  frontRight: "Passenger door",
  rearLeft: "Rear left door",
  rearRight: "Rear right door",
  trunk: "Tailgate",
};

function matchDoors(segment: string): DoorKey[] {
  const s = segment.toLowerCase();
  if (/\b(trunk|boot|tailgate|liftgate|hatch)\b/.test(s)) return ["trunk"];
  const keys: DoorKey[] = [];
  if (/\bdriver/.test(s)) keys.push("frontLeft");
  if (/\bpassenger/.test(s)) keys.push("frontRight");
  if (/\bfront\s+left\b|\bleft\s+front\b/.test(s)) keys.push("frontLeft");
  if (/\bfront\s+right\b|\bright\s+front\b/.test(s)) keys.push("frontRight");
  if (/\b(rear|back)\s+left\b|\bleft\s+(rear|back)\b/.test(s)) keys.push("rearLeft");
  if (/\b(rear|back)\s+right\b|\bright\s+(rear|back)\b/.test(s)) keys.push("rearRight");
  if (keys.length === 0) {
    if (/\bfront\b/.test(s)) keys.push("frontLeft", "frontRight");
    else if (/\b(rear|back)\b/.test(s)) keys.push("rearLeft", "rearRight");
    else if (/\bleft\b/.test(s)) keys.push("frontLeft", "rearLeft");
    else if (/\bright\b/.test(s)) keys.push("frontRight", "rearRight");
  }
  if (keys.length === 0) keys.push("frontLeft"); // "open the door" → driver door
  return [...new Set(keys)];
}

export function parseCommand(text: string): ParsedCommand {
  let s = ` ${text.toLowerCase().trim()} `;
  const patch: ConfigPatch = {};
  const labels: string[] = [];
  const actions: ParsedCommand["actions"] = [];
  const doors: Partial<Record<DoorKey, boolean>> = {};

  // --- actions -----------------------------------------------------
  if (/\b(rebuild|re-?assemble|build (it|the|my|again)|start over|restart|assemble)\b/.test(s)) {
    actions.push("assemble");
    labels.push("Rebuilding your Mazda");
  }
  if (/\b(book|reserve|schedule|test.?drive)\b/.test(s)) {
    actions.push("book");
    labels.push("Booking → test drive");
    s = s.replace(/\btest.?drive\b/g, " ");
  }
  if (/\b(drive|driving|cruise|spin|roll|let'?s go)\b/.test(s) && !actions.includes("book")) {
    actions.push("drive");
    labels.push("Drive mode → on");
    s = s.replace(/\b(drive|driving|cruise|spin|roll)\b/g, " ");
  }
  if (/\b(stop|park|pull over|stand still)\b/.test(s)) {
    actions.push("park");
    labels.push("Drive mode → off");
  }

  // --- doors: parse and consume the matched phrases so that door     --
  // --- words ("front", "back") don't leak into the view matcher.    --
  const doorPhrase =
    /\b(open|close|shut|pop)\s+(?:the\s+|all\s+|both\s+|every\s+)*((?:driver'?s?|passenger|front|rear|back|left|right|\s)*)\s*(doors?|trunk|boot|tailgate|liftgate|hatch)\b/g;
  let m: RegExpExecArray | null;
  while ((m = doorPhrase.exec(s)) !== null) {
    const open = m[1] === "open" || m[1] === "pop";
    const segment = `${m[2]} ${m[3]}`;
    const all = /\b(all|every|both)\b/.test(m[0]) && /doors?/.test(m[3]);
    const keys = all
      ? (["frontLeft", "frontRight", "rearLeft", "rearRight"] as DoorKey[])
      : matchDoors(segment);
    keys.forEach((k) => {
      doors[k] = open;
      labels.push(`${DOOR_LABELS[k]} → ${open ? "open" : "closed"}`);
    });
  }
  s = s.replace(doorPhrase, " ");
  // "open everything"
  if (/\b(open|close|shut)\s+everything\b/.test(s)) {
    const open = /\bopen\s+everything\b/.test(s);
    (["frontLeft", "frontRight", "rearLeft", "rearRight", "trunk"] as DoorKey[]).forEach(
      (k) => (doors[k] = open),
    );
    labels.push(`All doors → ${open ? "open" : "closed"}`);
    s = s.replace(/\b(open|close|shut)\s+everything\b/g, " ");
  }

  // --- environment ---------------------------------------------------
  for (const [re, env] of ENV_WORDS) {
    if (re.test(s)) {
      patch.environment = env;
      labels.push(`Scene → ${ENVIRONMENTS[env].name}`);
      s = s.replace(re, " ");
      break;
    }
  }

  // --- interior ------------------------------------------------------
  const interior: ConfigPatch["interior"] = {};
  if (/\b(nappa)\b/.test(s)) interior.material = "nappa";
  else if (/\b(leatherette|micro.?suede|suede|synthetic|vegan)\b/.test(s))
    interior.material = "leatherette";
  else if (/\b(leather)\b/.test(s)) interior.material = "leather";
  else if (/\b(cloth|fabric|textile|woven)\b/.test(s)) interior.material = "cloth";

  for (const [words, id] of INTERIOR_COLOR_WORDS) {
    const near = new RegExp(
      `\\b(${words})\\b[\\w\\s,'-]{0,18}\\b(${CABIN_CTX})\\b|\\b(${CABIN_CTX})\\b[\\w\\s,'-]{0,18}\\b(${words})\\b`,
    );
    if (near.test(s)) {
      interior.color = id;
      s = s.replace(new RegExp(`\\b(${words})\\b`, "g"), " ");
      break;
    }
  }
  if (interior.material !== undefined || interior.color !== undefined) {
    patch.interior = interior;
    const mat = interior.material ? INTERIOR_MATERIALS[interior.material].name : null;
    const col = interior.color ? INTERIOR_COLORS[interior.color].name : null;
    labels.push(`Interior → ${[col, mat].filter(Boolean).join(" ")}`);
  }

  // --- colour ------------------------------------------------------
  const wantsColor =
    /\b(colou?r|paint|make it|in)\b/.test(s) ||
    COLOR_WORDS.some(([re]) => re.test(s));
  if (wantsColor) {
    for (const [re, id] of COLOR_WORDS) {
      if (re.test(s)) {
        patch.color = id;
        labels.push(`Colour → ${PAINTS[id].name}`);
        s = s.replace(re, " ");
        break;
      }
    }
  }

  // --- view --------------------------------------------------------
  for (const [re, view] of VIEW_WORDS) {
    if (re.test(s)) {
      patch.view = view;
      labels.push(`View → ${view[0].toUpperCase()}${view.slice(1)}`);
      if (view === "trunk") {
        // "show me the trunk" implies opening it
        if (doors.trunk === undefined) {
          doors.trunk = true;
          labels.push("Tailgate → open");
        }
      }
      break;
    }
  }

  if (Object.keys(doors).length > 0) patch.doors = doors;
  return { patch, labels, actions };
}
