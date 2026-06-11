import { ASSEMBLY_DONE, useStore } from "../state/store";

export default function TopBar() {
  const built = useStore((s) => s.config.assemblyStep >= ASSEMBLY_DONE);
  const started = useStore((s) => s.started);
  const setBooking = useStore((s) => s.setBooking);

  return (
    <header className={`topbar ${started ? "visible" : ""}`}>
      <div className="brand">
        <span className="brand-mark">MAZDA</span>
        <span className="brand-sub">Test Drive Studio</span>
      </div>
      <button
        className="cta"
        disabled={!built}
        onClick={() => setBooking(true)}
      >
        Book test drive
      </button>
    </header>
  );
}
