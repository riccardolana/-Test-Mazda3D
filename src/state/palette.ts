import type { PaintId, ViewName, DoorKey } from "./store";

export interface Paint {
  name: string;
  hex: string;
  /** Swatch gradient highlight for the UI chip */
  sheen: string;
}

export const PAINTS: Record<PaintId, Paint> = {
  soulRed: { name: "Soul Red Crystal", hex: "#a01e22", sheen: "#d4494e" },
  machineGrey: { name: "Machine Grey Metallic", hex: "#54565a", sheen: "#9a9da3" },
  snowWhite: { name: "Snowflake White Pearl", hex: "#f2f3f4", sheen: "#ffffff" },
  crystalBlue: { name: "Deep Crystal Blue", hex: "#16304d", sheen: "#3c6ca3" },
  jetBlack: { name: "Jet Black Mica", hex: "#0c0c0c", sheen: "#4a4a52" },
  zirconSand: { name: "Zircon Sand", hex: "#b5ab94", sheen: "#ded5c0" },
};

export const PAINT_IDS = Object.keys(PAINTS) as PaintId[];

export const VIEWS: { id: ViewName; label: string }[] = [
  { id: "exterior", label: "Exterior" },
  { id: "front", label: "Front" },
  { id: "rear", label: "Rear" },
  { id: "wheels", label: "Wheels" },
  { id: "interior", label: "Interior" },
  { id: "trunk", label: "Trunk" },
];

export const DOORS: { id: DoorKey; label: string; short: string }[] = [
  { id: "frontLeft", label: "Driver door", short: "Driver" },
  { id: "frontRight", label: "Passenger door", short: "Passenger" },
  { id: "rearLeft", label: "Rear left door", short: "Rear L" },
  { id: "rearRight", label: "Rear right door", short: "Rear R" },
  { id: "trunk", label: "Tailgate", short: "Tailgate" },
];

export const VIEW_LABELS: Record<ViewName, string> = {
  exterior: "Exterior",
  front: "Front",
  rear: "Rear",
  wheels: "Wheels",
  interior: "Interior",
  trunk: "Trunk",
};
