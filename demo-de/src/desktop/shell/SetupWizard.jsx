/* NCT-WL-KIT — the Setup Wizard: FOUNDATION ONLY (user, 2026-11-25).
 *
 * This wizard is what a person meets when they first launch
 * the desktop environment. It is deliberately NOT MOUNTED
 * anywhere yet — nothing imports this file, so it never
 * displays. What exists today is the foundation it will stand
 * on:
 *
 *   - the step list (SETUP_STEPS), in order, each step a
 *     self-contained panel;
 *   - the Platform Configuration step, which is a real step
 *     here and shares its picker and its setting with
 *     Settings → Environment → Platform Configuration
 *     (apps/PlatformPicker.jsx, core/platform.js);
 *   - the run state: settings.setup.completed (false until
 *     the wizard finishes) and isSetupPending(), which is how
 *     the shell will know, on a later first launch, that the
 *     wizard is owed. (The store is in-memory today; when
 *     settings gain persistence, first-launch detection rides
 *     on this same flag.)
 *
 * When the time comes, the shell mounts <SetupWizard /> over
 * the desktop while isSetupPending(settings) is true, and
 * finishing (or skipping) calls the same completion path the
 * Finish step uses here.
 */

import { useState } from "react";
import { useSlice, setSetup } from "../core/react.js";
import PlatformPicker from "../apps/PlatformPicker.jsx";

export function isSetupPending(settings) {
  return !(settings && settings.setup && settings.setup.completed);
}

export const SETUP_STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "platform", title: "Platform Configuration" },
  { id: "finish", title: "Finish" },
];

function WelcomeStep() {
  return (
    <div>
      <div className="appset-title">Welcome to Noctivagous</div>
      <p style={{ fontSize: 12.5, color: "#c9c9c9", lineHeight: 1.55 }}>
        A few choices set this environment up the way you already know how to use it.
        Nothing here is final — every choice can be changed later in System Settings.
      </p>
    </div>
  );
}

function PlatformStep({ settings }) {
  return (
    <div>
      <div className="appset-title">Platform Configuration</div>
      <p style={{ fontSize: 12.5, color: "#c9c9c9", lineHeight: 1.55 }}>
        Where are you coming from? If you come from Mac OS, the environment emphasises
        the Command key. If you come from a PC — Windows or a regular Linux — it uses
        PC keyboard layouts.
      </p>
      <PlatformPicker settings={settings} />
    </div>
  );
}

function FinishStep({ settings }) {
  const chosen = settings.platform && settings.platform.origin;
  return (
    <div>
      <div className="appset-title">Ready</div>
      <p style={{ fontSize: 12.5, color: "#c9c9c9", lineHeight: 1.55 }}>
        {chosen
          ? "Your platform is set. You can change it any time in System Settings → Environment → Platform Configuration."
          : "You have not chosen a platform — the environment will behave as a PC Linux, and you can choose any time in System Settings → Environment → Platform Configuration."}
      </p>
    </div>
  );
}

export default function SetupWizard() {
  const settings = useSlice("settings");
  const [stepIdx, setStepIdx] = useState(0);
  const step = SETUP_STEPS[stepIdx];
  const last = stepIdx === SETUP_STEPS.length - 1;
  const finish = () => setSetup({ completed: true });
  return (
    <div className="setup-wizard" data-setup-wizard>
      <div className="setup-wizard-card">
        <div className="cap" style={{ marginBottom: 8 }}>
          Setup · {stepIdx + 1} of {SETUP_STEPS.length} · {step.title}
        </div>
        {step.id === "welcome" && <WelcomeStep />}
        {step.id === "platform" && <PlatformStep settings={settings} />}
        {step.id === "finish" && <FinishStep settings={settings} />}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {stepIdx > 0 && (
            <button className="btn sm" onClick={() => setStepIdx(stepIdx - 1)}>Back</button>
          )}
          <span style={{ flex: 1 }}></span>
          {!last ? (
            <button className="btn sm primary" onClick={() => setStepIdx(stepIdx + 1)}>Continue</button>
          ) : (
            <button className="btn sm primary" onClick={finish}>Finish</button>
          )}
        </div>
      </div>
    </div>
  );
}
