import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { PAINTS, VIEW_LABELS } from "../state/palette";

/** Fake booking summary that closes the demo's narrative loop. */
export default function BookingModal() {
  const open = useStore((s) => s.bookingOpen);
  const booked = useStore((s) => s.booked);
  const config = useStore((s) => s.config);
  const capture = useStore((s) => s.capture);
  const setBooking = useStore((s) => s.setBooking);
  const confirmBooking = useStore((s) => s.confirmBooking);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (open && capture) setSnapshot(capture());
  }, [open, capture]);

  // standard dialog affordance: Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBooking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setBooking]);

  if (!open) return null;

  const openDoors = Object.values(config.doors).filter(Boolean).length;

  return (
    <div className="modal-backdrop" onClick={() => setBooking(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        onClick={(e) => e.stopPropagation()}
      >
        {snapshot && <img className="modal-snapshot" src={snapshot} alt="Your configured Mazda CX-5" />}
        {!booked ? (
          <>
            <h2 id="booking-title">Your test drive</h2>
            <ul className="modal-summary">
              <li>
                <span>Model</span>
                <strong>Mazda CX-5</strong>
              </li>
              <li>
                <span>Colour</span>
                <strong>
                  <i
                    className="dot"
                    style={{ background: PAINTS[config.color].hex }}
                  />
                  {PAINTS[config.color].name}
                </strong>
              </li>
              <li>
                <span>Last view</span>
                <strong>{VIEW_LABELS[config.view]}</strong>
              </li>
              <li>
                <span>Slot</span>
                <strong>Saturday · 10:00 · Mazda Studio Milano</strong>
              </li>
            </ul>
            <button className="cta wide" onClick={confirmBooking}>
              Confirm booking
            </button>
            <button className="ghost" onClick={() => setBooking(false)}>
              Keep configuring
            </button>
          </>
        ) : (
          <>
            <div className="booked-check" aria-hidden="true">✓</div>
            <h2 id="booking-title">You’re booked in</h2>
            <p className="booked-copy">
              Your {PAINTS[config.color].name} CX-5 will be waiting on Saturday at
              10:00, Mazda Studio Milano. See you there.
              {openDoors > 0 ? " We’ll close the doors for you." : ""}
            </p>
            <button className="cta wide" onClick={() => setBooking(false)}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
