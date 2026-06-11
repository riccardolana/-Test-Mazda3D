import { useProgress } from "@react-three/drei";
import { ASSEMBLY_CAPTIONS, useStore } from "../state/store";

export default function IntroOverlay() {
  const started = useStore((s) => s.started);
  const assembling = useStore((s) => s.assembling);
  const step = useStore((s) => s.config.assemblyStep);
  const startAssembly = useStore((s) => s.startAssembly);
  const skipIntro = useStore((s) => s.skipIntro);
  const { active, progress } = useProgress();
  const loading = active && progress < 100;

  if (started) {
    // step captions during the build choreography
    return assembling ? (
      <div className="assembly-caption" key={step}>
        {ASSEMBLY_CAPTIONS[step]}
      </div>
    ) : null;
  }

  return (
    <div className="intro">
      <div className="intro-inner">
        <p className="intro-kicker">The future of test drive booking</p>
        <h1 className="intro-title">
          MAZDA <span>CX-5</span>
        </h1>
        <p className="intro-copy">
          Tell the agent what you want — colour, doors, the boot, the cabin —
          and watch your car come together before you book the drive.
        </p>
        <button className="intro-start" disabled={loading} onClick={startAssembly}>
          {loading ? `Loading model… ${Math.round(progress)}%` : "Build your Mazda"}
        </button>
        <button className="intro-skip" disabled={loading} onClick={skipIntro}>
          Skip intro
        </button>
      </div>
    </div>
  );
}
