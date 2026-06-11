import { useState } from "react";
import type { FormEvent } from "react";

/**
 * Client-side password wall (replaces the old Basic Auth middleware).
 * Demo-grade access control, not security: the password is hardcoded and
 * assets remain technically fetchable without it (same accepted tradeoff
 * as the public GLB). sessionStorage flag → gate shows once per tab.
 * The app keeps loading underneath — the assembly intro waits for a click
 * anyway, so nothing leaks.
 */
const PASSWORD = "mazda3D";
const STORAGE_KEY = "mazda-v2-access";

export default function PasswordGate() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "ok",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "ok");
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Password required">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">MAZDA</span>
          <span className="brand-sub">Test Drive Studio</span>
        </div>
        <p className="gate-hint">Enter password to continue</p>
        <form onSubmit={submit} noValidate>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            aria-invalid={error}
            className={error ? "gate-input error" : "gate-input"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          {error && <p className="gate-error">Incorrect password — try again.</p>}
          <button type="submit" className="cta gate-submit">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
