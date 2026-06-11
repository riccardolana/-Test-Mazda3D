import { useEffect, useRef, useState } from "react";
import { ASSEMBLY_DONE, useStore } from "../state/store";
import {
  DOORS,
  ENVIRONMENTS,
  ENVIRONMENT_IDS,
  INTERIOR_COLORS,
  INTERIOR_COLOR_IDS,
  INTERIOR_MATERIALS,
  PAINTS,
  PAINT_IDS,
  VIEWS,
} from "../state/palette";
import { mazdaAgent } from "../agent/agentBridge";
import { STAGES, startGuide } from "../agent/guide";
import { isVoiceMuted, setVoiceMuted, speak } from "../agent/voice";

/* The voice-agent surface: during the guided build it shows the       */
/* agent's question + suggestion chips; afterwards the full control    */
/* rows. All input paths end in mazdaAgent.say() → ConfigPatch.        */

const SpeechRecognitionImpl: (new () => SpeechRecognition) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export default function AgentPanel() {
  const config = useStore((s) => s.config);
  const started = useStore((s) => s.started);
  const assembling = useStore((s) => s.assembling);
  const guideStage = useStore((s) => s.guideStage);
  const agentLine = useStore((s) => s.agentLine);
  const applyConfig = useStore((s) => s.applyConfig);
  const toggleDoor = useStore((s) => s.toggleDoor);
  const notify = useStore((s) => s.notify);

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(isVoiceMuted());
  const recRef = useRef<SpeechRecognition | null>(null);

  const built = config.assemblyStep >= ASSEMBLY_DONE;
  const visible = started && !assembling && built;
  const guideActive = guideStage !== null && guideStage !== "done";

  // auto-start the guided build the first time the car is fully built
  useEffect(() => {
    if (visible && guideStage === null) startGuide();
  }, [visible, guideStage]);

  // the agent speaks whatever it says
  useEffect(() => {
    if (agentLine && visible) speak(agentLine);
  }, [agentLine, visible]);

  const runCommand = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const res = mazdaAgent.say(cmd);
    if (!("guided" in res) && res.labels.length === 0) {
      notify("Hmm — try “make it red and show me the trunk”");
    }
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
      {/* agent bubble — the guide's current line */}
      {agentLine && (
        <div className="agent-bubble" role="status" aria-live="polite">
          <span className="agent-dot" aria-hidden="true" />
          <p>{agentLine}</p>
          <button
            type="button"
            className="mute"
            title={muted ? "Unmute agent voice" : "Mute agent voice"}
            aria-label={muted ? "Unmute agent voice" : "Mute agent voice"}
            aria-pressed={muted}
            onClick={() => {
              setVoiceMuted(!muted);
              setMuted(!muted);
            }}
          >
            <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
          </button>
        </div>
      )}

      {/* guided mode: stage suggestion chips */}
      {guideStage !== null && guideStage !== "done" && (
        <div className="panel-row chips">
          {STAGES[guideStage].chips.map((c) => (
            <button key={c} className="chip" onClick={() => runCommand(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* freeform mode: the full control surface */}
      {!guideActive && (
        <>
          <div className="panel-row swatches">
            {PAINT_IDS.map((id) => (
              <button
                key={id}
                title={PAINTS[id].name}
                aria-label={PAINTS[id].name}
                aria-pressed={config.color === id}
                className={`swatch ${config.color === id ? "active" : ""}`}
                style={{
                  background: `radial-gradient(circle at 32% 28%, ${PAINTS[id].sheen}, ${PAINTS[id].hex} 62%)`,
                }}
                onClick={() => applyConfig({ color: id }, `Colour → ${PAINTS[id].name}`)}
              />
            ))}
            <span className="swatch-label">{PAINTS[config.color].name}</span>
          </div>

          {/* interior material + colour */}
          <div className="panel-row chips">
            {(Object.keys(INTERIOR_MATERIALS) as ("leather" | "cloth")[]).map((mId) => (
              <button
                key={mId}
                aria-pressed={config.interior.material === mId}
                className={`chip ${config.interior.material === mId ? "active" : ""}`}
                onClick={() =>
                  applyConfig(
                    { interior: { material: mId }, view: "interior" },
                    `Interior → ${INTERIOR_MATERIALS[mId].name}`,
                  )
                }
              >
                {INTERIOR_MATERIALS[mId].name}
              </button>
            ))}
            {INTERIOR_COLOR_IDS.map((id) => (
              <button
                key={id}
                title={INTERIOR_COLORS[id].name}
                aria-label={INTERIOR_COLORS[id].name}
                aria-pressed={config.interior.color === id}
                className={`swatch small ${config.interior.color === id ? "active" : ""}`}
                style={{
                  background: `radial-gradient(circle at 32% 28%, ${INTERIOR_COLORS[id].sheen}, ${INTERIOR_COLORS[id].hex} 62%)`,
                }}
                onClick={() =>
                  applyConfig(
                    { interior: { color: id }, view: "interior" },
                    `Cabin → ${INTERIOR_COLORS[id].name}`,
                  )
                }
              />
            ))}
          </div>

          {/* environments + drive */}
          <div className="panel-row chips">
            {ENVIRONMENT_IDS.map((e) => (
              <button
                key={e}
                aria-pressed={config.environment === e}
                className={`chip ${config.environment === e ? "active" : ""}`}
                onClick={() => applyConfig({ environment: e }, `Scene → ${ENVIRONMENTS[e].name}`)}
              >
                {ENVIRONMENTS[e].name}
              </button>
            ))}
            <button
              aria-pressed={config.driving}
              className={`chip drive ${config.driving ? "active" : ""}`}
              onClick={() =>
                applyConfig(
                  { driving: !config.driving },
                  `Drive mode → ${config.driving ? "off" : "on"}`,
                )
              }
            >
              <span aria-hidden="true">{config.driving ? "■" : "▶"}</span>
              {config.driving ? "Stop" : "Drive"}
            </button>
          </div>

          <div className="panel-row chips">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                aria-pressed={config.view === v.id}
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

          <div className="panel-row chips">
            {DOORS.map((d) => (
              <button
                key={d.id}
                aria-label={`${d.label} — ${config.doors[d.id] ? "open" : "closed"}`}
                aria-pressed={config.doors[d.id]}
                className={`chip door ${config.doors[d.id] ? "active" : ""}`}
                onClick={() => toggleDoor(d.id)}
              >
                {d.short}
                <span className="chip-state">{config.doors[d.id] ? "open" : "closed"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* agent command box (always available) */}
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
          aria-label={listening ? "Stop listening" : "Start voice input"}
          aria-pressed={listening}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            listening
              ? "Listening…"
              : guideActive
                ? "Answer the agent — or tap a suggestion"
                : "Ask the agent — “take me to the mountains and drive”"
          }
          aria-label="Agent command"
        />
        <button type="submit" className="send" disabled={!text.trim()} aria-label="Send command">
          <span aria-hidden="true">↑</span>
        </button>
      </form>
    </div>
  );
}
