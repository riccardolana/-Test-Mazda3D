import { useRef, useState } from "react";
import { ASSEMBLY_DONE, useStore } from "../state/store";
import { DOORS, PAINTS, PAINT_IDS, VIEWS } from "../state/palette";
import { parseCommand } from "../agent/parseCommand";

/* Stand-in for the voice agent: quick-action chips mutate CarConfig    */
/* directly; the command box routes free text through parseCommand().  */

const SpeechRecognitionImpl: (new () => SpeechRecognition) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export default function AgentPanel() {
  const config = useStore((s) => s.config);
  const started = useStore((s) => s.started);
  const assembling = useStore((s) => s.assembling);
  const applyConfig = useStore((s) => s.applyConfig);
  const toggleDoor = useStore((s) => s.toggleDoor);
  const startAssembly = useStore((s) => s.startAssembly);
  const setBooking = useStore((s) => s.setBooking);
  const notify = useStore((s) => s.notify);

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  const built = config.assemblyStep >= ASSEMBLY_DONE;
  const visible = started && !assembling && built;

  const runCommand = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const { patch, labels, actions } = parseCommand(cmd);
    if (labels.length === 0) {
      notify("Hmm — try “make it red and show me the trunk”");
    } else {
      applyConfig(patch, labels.join("  ·  "));
    }
    if (actions.includes("assemble")) startAssembly();
    if (actions.includes("book")) setBooking(true);
    setText("");
  };

  const toggleVoice = () => {
    if (!SpeechRecognitionImpl) {
      notify("Voice input isn’t supported in this browser — type instead");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionImpl();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      runCommand(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className={`panel ${visible ? "visible" : ""}`}>
      {/* paint swatches */}
      <div className="panel-row swatches">
        {PAINT_IDS.map((id) => (
          <button
            key={id}
            title={PAINTS[id].name}
            className={`swatch ${config.color === id ? "active" : ""}`}
            style={{
              background: `radial-gradient(circle at 32% 28%, ${PAINTS[id].sheen}, ${PAINTS[id].hex} 62%)`,
            }}
            onClick={() => applyConfig({ color: id }, `Colour → ${PAINTS[id].name}`)}
          />
        ))}
        <span className="swatch-label">{PAINTS[config.color].name}</span>
      </div>

      {/* camera views */}
      <div className="panel-row chips">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`chip ${config.view === v.id ? "active" : ""}`}
            onClick={() =>
              applyConfig(
                v.id === "trunk"
                  ? { view: v.id, doors: { trunk: true } }
                  : { view: v.id },
                `View → ${v.label}`,
              )
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* doors */}
      <div className="panel-row chips">
        {DOORS.map((d) => (
          <button
            key={d.id}
            className={`chip door ${config.doors[d.id] ? "active" : ""}`}
            onClick={() => toggleDoor(d.id)}
          >
            {d.short}
            <span className="chip-state">{config.doors[d.id] ? "open" : "closed"}</span>
          </button>
        ))}
      </div>

      {/* agent command box */}
      <form
        className="command"
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(text);
        }}
      >
        <button
          type="button"
          className={`mic ${listening ? "listening" : ""}`}
          onClick={toggleVoice}
          title="Voice input"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening…" : "Ask the agent — “make it red and show me the trunk”"}
          aria-label="Agent command"
        />
        <button type="submit" className="send" disabled={!text.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
