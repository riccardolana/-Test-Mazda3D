import { useEffect, useState } from "react";
import { useStore } from "../state/store";

/** Small confirmation of the parsed agent intent, e.g. "✓ Colour → Soul Red". */
export default function IntentToast() {
  const lastIntent = useStore((s) => s.lastIntent);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastIntent) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [lastIntent]);

  if (!lastIntent) return null;
  return (
    <div className={`intent-toast ${visible ? "show" : ""}`}>
      <span className="intent-check">✓</span> {lastIntent.text}
    </div>
  );
}
