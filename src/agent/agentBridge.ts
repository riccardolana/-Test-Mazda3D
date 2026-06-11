import { useStore } from "../state/store";
import { parseCommand } from "./parseCommand";
import { answerGuided, startGuide } from "./guide";
import type { ConfigPatch } from "../state/store";

/* ------------------------------------------------------------------ */
/* The integration surface for the future voice agent. A real agent    */
/* (LLM + speech) would call exactly these functions — nothing in the  */
/* scene listens to anything else. Exposed on window for demos and     */
/* for driving the app from the console.                               */
/* ------------------------------------------------------------------ */

export const mazdaAgent = {
  /** Apply a structured CarConfig patch (what a voice agent emits). */
  apply(patch: ConfigPatch, intent?: string) {
    useStore.getState().applyConfig(patch, intent);
  },
  /** Free text in. While the guided build is active it answers the    */
  /** current stage; afterwards it's the freeform keyword parser.      */
  say(text: string) {
    if (answerGuided(text)) return { guided: true as const };
    const { patch, labels, actions } = parseCommand(text);
    const store = useStore.getState();
    if (actions.includes("drive")) patch.driving = true;
    if (actions.includes("park")) patch.driving = false;
    if (labels.length > 0) store.applyConfig(patch, labels.join("  ·  "));
    if (actions.includes("assemble")) store.startAssembly();
    if (actions.includes("book")) store.setBooking(true);
    return { patch, labels, actions };
  },
  /** Kick off (or restart) the guided build conversation. */
  startGuide() {
    startGuide();
  },
  /** Read the current configuration. */
  get config() {
    return useStore.getState().config;
  },
  /** Restart the assembly choreography. */
  rebuild() {
    useStore.getState().startAssembly();
  },
};

declare global {
  interface Window {
    mazdaAgent: typeof mazdaAgent;
  }
}

if (typeof window !== "undefined") {
  window.mazdaAgent = mazdaAgent;
}
