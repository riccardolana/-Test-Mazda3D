/* Speech synthesis for the agent's lines. Browser-only, no backend.   */
/* Degrades silently where speechSynthesis is unavailable.             */

let muted = false;

export function speak(text: string) {
  if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '"'));
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function setVoiceMuted(v: boolean) {
  muted = v;
  if (v && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceMuted() {
  return muted;
}
