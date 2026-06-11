import { create } from "zustand";

/* ------------------------------------------------------------------ */
/* CarConfig — the single structured state object that drives the     */
/* entire 3D scene. The UI mutates it today; a voice agent will emit  */
/* the same patches tomorrow. Nothing in the scene reacts to raw text. */
/* ------------------------------------------------------------------ */

export type ViewName = "exterior" | "interior" | "trunk" | "front" | "rear" | "wheels";
export type PaintId = "soulRed" | "machineGrey" | "snowWhite" | "crystalBlue" | "jetBlack" | "zirconSand";
export type DoorKey = "frontLeft" | "frontRight" | "rearLeft" | "rearRight" | "trunk";

/** the real 2026 CX-5 upholstery lineup: cloth (base), leatherette with
 *  microsuede inserts (S Select), leather (S Premium), Nappa (top trims) */
export type InteriorMaterial = "cloth" | "leatherette" | "leather" | "nappa";
export type InteriorColorId = "obsidian" | "tan" | "cognac" | "greige";
export type EnvironmentId = "studio" | "mountain" | "city" | "coast";
export type GuideStage = "vibe" | "material" | "cabinColor" | "lifestyle" | "reveal" | "done";

export interface InteriorConfig {
  material: InteriorMaterial;
  color: InteriorColorId;
}

export type DoorState = Record<DoorKey, boolean>;

export interface CarConfig {
  color: PaintId;
  view: ViewName;
  doors: DoorState;
  trim: "base" | "premium";
  interior: InteriorConfig;
  environment: EnvironmentId;
  /** drive-mode showcase: wheels spin, ground scrolls, chase camera */
  driving: boolean;
  /** 0 = staged (parts floating), ASSEMBLY_DONE = fully built */
  assemblyStep: number;
}

export const ASSEMBLY_DONE = 5;

/** scene units (≈ metres) per second in drive mode — shared by wheels & ground scroll */
export const DRIVE_SPEED = 8;

/** ms timestamps for each assembly step, relative to startAssembly() */
const ASSEMBLY_TIMINGS = [300, 1500, 2900, 4300, 5800];

export const ASSEMBLY_CAPTIONS: Record<number, string> = {
  0: "Preparing the studio…",
  1: "Lowering the body shell",
  2: "Rolling in the wheels",
  3: "Fitting the cabin and seats",
  4: "Attaching doors and lights",
  5: "Your Mazda is ready",
};

export type ConfigPatch = Partial<Omit<CarConfig, "doors" | "interior">> & {
  doors?: Partial<DoorState>;
  interior?: Partial<InteriorConfig>;
};

const CLOSED_DOORS: DoorState = {
  frontLeft: false,
  frontRight: false,
  rearLeft: false,
  rearRight: false,
  trunk: false,
};

interface AppState {
  config: CarConfig;
  /** intro overlay not yet dismissed */
  started: boolean;
  /** assembly choreography currently running */
  assembling: boolean;
  bookingOpen: boolean;
  booked: boolean;
  lastIntent: { text: string; ts: number } | null;
  /** guided build: null = not started, "done" = finished (freeform mode) */
  guideStage: GuideStage | null;
  /** what the agent is currently saying (displayed + spoken) */
  agentLine: string | null;
  /** registered by the canvas so the booking card can snapshot the car */
  capture: (() => string) | null;

  applyConfig: (patch: ConfigPatch, intent?: string) => void;
  toggleDoor: (door: DoorKey) => void;
  startAssembly: () => void;
  skipIntro: () => void;
  setBooking: (open: boolean) => void;
  confirmBooking: () => void;
  setCapture: (fn: () => string) => void;
  setGuide: (stage: GuideStage | null, line: string | null) => void;
  notify: (text: string) => void;
}

let assemblyTimers: ReturnType<typeof setTimeout>[] = [];

export const useStore = create<AppState>((set, get) => ({
  config: {
    color: "soulRed",
    view: "exterior",
    doors: { ...CLOSED_DOORS },
    trim: "base",
    interior: { material: "leather", color: "obsidian" },
    environment: "studio",
    driving: false,
    assemblyStep: 0,
  },
  started: false,
  assembling: false,
  bookingOpen: false,
  booked: false,
  lastIntent: null,
  guideStage: null,
  agentLine: null,
  capture: null,

  applyConfig: (patch, intent) =>
    set((s) => ({
      config: {
        ...s.config,
        ...patch,
        doors: { ...s.config.doors, ...(patch.doors ?? {}) },
        interior: { ...s.config.interior, ...(patch.interior ?? {}) },
      },
      ...(intent ? { lastIntent: { text: intent, ts: Date.now() } } : {}),
    })),

  toggleDoor: (door) =>
    set((s) => ({
      config: {
        ...s.config,
        doors: { ...s.config.doors, [door]: !s.config.doors[door] },
      },
    })),

  startAssembly: () => {
    assemblyTimers.forEach(clearTimeout);
    assemblyTimers = [];
    set((s) => ({
      started: true,
      assembling: true,
      bookingOpen: false,
      booked: false,
      config: {
        ...s.config,
        assemblyStep: 0,
        view: "exterior",
        doors: { ...CLOSED_DOORS },
        driving: false,
      },
    }));
    ASSEMBLY_TIMINGS.forEach((t, i) => {
      assemblyTimers.push(
        setTimeout(() => {
          set((s) => ({
            config: { ...s.config, assemblyStep: i + 1 },
            ...(i + 1 === ASSEMBLY_DONE ? { assembling: false } : {}),
          }));
        }, t),
      );
    });
  },

  skipIntro: () =>
    set((s) => ({
      started: true,
      assembling: false,
      config: { ...s.config, assemblyStep: ASSEMBLY_DONE },
    })),

  setBooking: (open) => set({ bookingOpen: open, ...(open ? {} : { booked: false }) }),
  confirmBooking: () => set({ booked: true }),
  setCapture: (fn) => set({ capture: fn }),
  setGuide: (stage, line) => set({ guideStage: stage, agentLine: line }),
  notify: (text) => set({ lastIntent: { text, ts: Date.now() } }),
}));
