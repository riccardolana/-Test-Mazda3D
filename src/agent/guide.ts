import type {
  ConfigPatch,
  EnvironmentId,
  GuideStage,
  InteriorColorId,
  InteriorMaterial,
  PaintId,
} from "../state/store";
import { useStore } from "../state/store";
import { ENVIRONMENTS, INTERIOR_COLORS, INTERIOR_MATERIALS, PAINTS } from "../state/palette";

/* ------------------------------------------------------------------ */
/* The guided build: a tiny stage machine. Each stage asks a question, */
/* interprets the answer into a ConfigPatch, and hands over to the     */
/* next stage. stepGuide() is pure; answerGuided() applies to store.   */
/* Like parseCommand, this is the stand-in for the real LLM pipeline.  */
/* ------------------------------------------------------------------ */

export interface StageSpec {
  prompt: string;
  /** suggestion chips shown under the agent bubble */
  chips: string[];
}

export const STAGES: Record<Exclude<GuideStage, "done">, StageSpec> = {
  vibe: {
    prompt:
      "Let's build your CX-5 together. First, the exterior — what's the vibe you're going for?",
    chips: ["Bold & sporty", "Sleek & elegant", "Calm & minimal", "Deep & serene"],
  },
  material: {
    prompt:
      "Now step inside — Nappa leather, classic leather, leatherette with microsuede, or a softer cloth?",
    chips: ["Nappa leather", "Leather", "Leatherette + microsuede", "Urban cloth"],
  },
  cabinColor: {
    prompt: "And the cabin colour?",
    chips: ["Classic black", "Sports tan", "Cognac brown", "Light parchment"],
  },
  lifestyle: {
    prompt:
      "Last one — tell me about your week. Mountain trails, the daily city run, or escapes down the coast?",
    chips: ["I live for the mountains", "Family life in the city", "Weekends on the coast"],
  },
  reveal: {
    prompt: "There it is — your CX-5, right where it belongs. Want to see it move?",
    chips: ["Let's drive", "Maybe later"],
  },
};

const VIBE_MAP: [RegExp, PaintId][] = [
  [/\b(bold|sporty|sport|fun|energetic|passionate|fiery|red)\b/, "soulRed"],
  [/\b(sleek|elegant|professional|business|sophisticated|grey|gray|silver)\b/, "machineGrey"],
  [/\b(stealth|night|edgy|black|mysterious|dark)\b/, "jetBlack"],
  [/\b(calm|clean|minimal|fresh|pure|white|bright)\b/, "snowWhite"],
  [/\b(deep|serene|cool|ocean|blue|tranquil)\b/, "crystalBlue"],
  [/\b(warm|earthy|desert|sandy?|sunny|golden|beige)\b/, "zirconSand"],
];

const MATERIAL_MAP: [RegExp, InteriorMaterial][] = [
  [/\b(nappa|premium)\b/, "nappa"],
  [/\b(leatherette|micro.?suede|suede|synthetic|vegan)\b/, "leatherette"],
  [/\b(leather|classic)\b/, "leather"],
  [/\b(cloth|fabric|soft(er)?|textile|woven|eco)\b/, "cloth"],
];

const CABIN_COLOR_MAP: [RegExp, InteriorColorId][] = [
  [/\b(black|charcoal|obsidian|dark)\b/, "obsidian"],
  [/\b(cognac|brown|caramel|chestnut)\b/, "cognac"],
  [/\b(tan|saddle|sports?|warm)\b/, "tan"],
  [/\b(greige|grey|gray|stone|beige|cream|parchment|light)\b/, "greige"],
];

const LIFESTYLE_MAP: [RegExp, EnvironmentId][] = [
  [/\b(mountains?|hik\w+|trails?|ski\w*|climb\w*|outdoors?|camp\w*|nature|forest)\b/, "mountain"],
  [/\b(city|commut\w+|family|kids|school|office|urban|errands|daily)\b/, "city"],
  [/\b(coast\w*|beach|surf\w*|sea|sail\w*|road.?trips?|sun)\b/, "coast"],
];

const SURPRISE = /\b(surprise|you choose|you pick|dealer'?s choice|whatever|skip|anything)\b/;
const YES = /\b(yes|yeah|yep|sure|ok(ay)?|absolutely|drive|go|move|let'?s)\b/;

function pick<T>(table: [RegExp, T][], s: string, fallback: T): T | null {
  for (const [re, v] of table) if (re.test(s)) return v;
  if (SURPRISE.test(s)) return fallback;
  return null;
}

export interface GuideStep {
  patch: ConfigPatch;
  /** what the agent says next (ack + next question) */
  reply: string;
  /** short confirmation for the intent toast, "" if none */
  label: string;
  nextStage: GuideStage;
  actions: ("drive" | "book")[];
  matched: boolean;
}

const stay = (stage: Exclude<GuideStage, "done">, nudge: string): GuideStep => ({
  patch: {},
  reply: `${nudge} ${STAGES[stage].prompt}`,
  label: "",
  nextStage: stage,
  actions: [],
  matched: false,
});

export function stepGuide(stage: Exclude<GuideStage, "done">, text: string): GuideStep {
  const s = ` ${text.toLowerCase().trim()} `;

  switch (stage) {
    case "vibe": {
      const color = pick(VIBE_MAP, s, "soulRed");
      if (!color) return stay("vibe", "No rush — sporty, elegant, calm…?");
      return {
        patch: { color },
        reply: `${PAINTS[color].name} — great taste. ${STAGES.material.prompt}`,
        label: `Colour → ${PAINTS[color].name}`,
        nextStage: "material",
        actions: [],
        matched: true,
      };
    }
    case "material": {
      const material = pick(MATERIAL_MAP, s, "leather");
      if (!material) return stay("material", "Nappa, leather, leatherette or cloth?");
      return {
        patch: { interior: { material }, view: "interior" },
        reply: `${INTERIOR_MATERIALS[material].name}, nice. Have a look inside. ${STAGES.cabinColor.prompt}`,
        label: `Interior → ${INTERIOR_MATERIALS[material].name}`,
        nextStage: "cabinColor",
        actions: [],
        matched: true,
      };
    }
    case "cabinColor": {
      const color = pick(CABIN_COLOR_MAP, s, "obsidian");
      if (!color) return stay("cabinColor", "Black, tan, cognac or parchment?");
      return {
        patch: { interior: { color } },
        reply: `${INTERIOR_COLORS[color].name} it is. ${STAGES.lifestyle.prompt}`,
        label: `Cabin → ${INTERIOR_COLORS[color].name}`,
        nextStage: "lifestyle",
        actions: [],
        matched: true,
      };
    }
    case "lifestyle": {
      const environment = pick(LIFESTYLE_MAP, s, "mountain");
      if (!environment) return stay("lifestyle", "Tell me where life takes you —");
      return {
        patch: { environment, view: "exterior", doors: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false, trunk: false } },
        reply: `${ENVIRONMENTS[environment].blurb} — sounds like you. ${STAGES.reveal.prompt}`,
        label: `Scene → ${ENVIRONMENTS[environment].name}`,
        nextStage: "reveal",
        actions: [],
        matched: true,
      };
    }
    case "reveal": {
      if (YES.test(s)) {
        return {
          patch: { driving: true, view: "exterior" },
          reply:
            "Hold on — let's take it for a cruise. When you're convinced, just say “book my test drive”.",
          label: "Drive mode → on",
          nextStage: "done",
          actions: ["drive"],
          matched: true,
        };
      }
      return {
        patch: {},
        reply:
          "No problem — explore freely: colours, doors, scenes. Say “book a test drive” whenever you're ready.",
        label: "",
        nextStage: "done",
        actions: [],
        matched: true,
      };
    }
  }
}

/* ----------------------- store adapters --------------------------- */

export function startGuide() {
  useStore.getState().setGuide("vibe", STAGES.vibe.prompt);
}

/** Returns true if the utterance was consumed by the guide. */
export function answerGuided(text: string): boolean {
  const stage = useStore.getState().guideStage;
  if (!stage || stage === "done") return false;
  // booking is a global escape hatch at any stage
  if (/\b(book|reserve|test.?drive)\b/i.test(text)) {
    useStore.getState().setBooking(true);
    return true;
  }
  const step = stepGuide(stage, text);
  const store = useStore.getState();
  if (Object.keys(step.patch).length > 0) store.applyConfig(step.patch, step.label || undefined);
  store.setGuide(step.nextStage, step.reply);
  return true;
}
