import { create } from "zustand";

/* ------------------------------------------------------------------ */
/* CarConfig — the single structured state object that drives the     */
/* entire 3D scene. The UI mutates it today; a voice agent will emit  */
/* the same patches tomorrow. Nothing in the scene reacts to raw text. */
/* ------------------------------------------------------------------ */

export type ViewName = "exterior" | "interior" | "trunk" | "front" | "rear" | "wheels";
export type PaintId = "soulRed" | "machineGrey" | "snowWhite" | "crystalBlue" | "jetBlack" | "zirconSand";
export type DoorKey = "frontLeft" | "frontRight" | "rearLeft" | "rearRight" | "trunk";

export type DoorState = Record<DoorKey, boolean>;

export interface CarConfig {
  color: PaintId;
  view: ViewName;
  doors: DoorState;
  trim: "base" | "premium";
  /** 0 = staged (parts floating), ASSEMBLY_DONE = fully built */
  assemblyStep: number;
}

export const ASSEMBLY_DONE = 5;

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

export type ConfigPatch = Partial<Omit<CarConfig, "doors">> & { doors?: Partial<DoorState> };

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
  /** registered by the canvas so the booking card can snapshot the car */
  capture: (() => string) | null;

  applyConfig: (patch: ConfigPatch, intent?: string) => void;
  toggleDoor: (door: DoorKey) => void;
  startAssembly: () => void;
  skipIntro: () => void;
  setBooking: (open: boolean) => void;
  confirmBooking: () => void;
  setCapture: (fn: () => string) => void;
  notify: (text: string) => void;
}

let assemblyTimers: ReturnType<typeof setTimeout>[] = [];

export const useStore = create<AppState>((set, get) => ({
  config: {
    color: "soulRed",
    view: "exterior",
    doors: { ...CLOSED_DOORS },
    trim: "base",
    assemblyStep: 0,
  },
  started: false,
  assembling: false,
  bookingOpen: false,
  booked: false,
  lastIntent: null,
  capture: null,

  applyConfig: (patch, intent) =>
    set((s) => ({
      config: {
        ...s.config,
        ...patch,
        doors: { ...s.config.doors, ...(patch.doors ?? {}) },
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
  notify: (text) => set({ lastIntent: { text, ts: Date.now() } }),
}));
