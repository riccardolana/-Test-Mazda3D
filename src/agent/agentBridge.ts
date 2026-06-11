import { useStore } from "../state/store";
import { parseCommand } from "./parseCommand";
import type { ConfigPatch } from "../state/store";

/* ------------------------------------------------------------------ */
/* The integration surface for the future voice agent. A real agent    */
/* (LLM + speech) would call exactly these two functions — nothing in  */
/* the scene listens to anything else. Exposed on window for demos     */
/* and for driving the app from the console.                           */
/* ------------------------------------------------------------------ */

export const mazdaAgent = {
  /** Apply a structured CarConfig patch (what a voice agent emits). */
  apply(patch: ConfigPatch, intent?: string) {
    useStore.getState().applyConfig(patch, intent);
  },
  /** Run a free-text command through the demo keyword parser. */
  say(text: string) {
    const { patch, labels, actions } = parseCommand(text);
    const store = useStore.getState();
    if (labels.length > 0) store.applyConfig(patch, labels.join("  ·  "));
    if (actions.includes("assemble")) store.startAssembly();
    if (actions.includes("book")) store.setBooking(true);
    return { patch, labels, actions };
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

window.mazdaAgent = mazdaAgent;
