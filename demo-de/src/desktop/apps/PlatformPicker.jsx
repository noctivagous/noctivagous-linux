/* The Platform Configuration picker — ONE component shared by
 * Settings → Environment → Platform Configuration and the Setup
 * Wizard's Platform step, so the choice is made the same way in
 * both places and stored in the same setting
 * (settings.platform.origin, core/platform.js). */

import { PLATFORM_PROFILES, PLATFORM_ORDER, platformProfile } from "../core/platform.js";
import { setPlatform } from "../core/react.js";

export default function PlatformPicker({ settings }) {
  const origin = settings.platform ? settings.platform.origin : null;
  const profile = platformProfile(settings);
  return (
    <div data-platform-picker>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {PLATFORM_ORDER.map((id) => {
          const p = PLATFORM_PROFILES[id];
          return (
            <label key={id} className="radio" style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <input type="radio" name="platform-origin" data-platform={id}
                checked={origin === id}
                onChange={() => setPlatform({ origin: id })} />
              <span>
                <b style={{ color: "#e6e6e6" }}>{p.name}</b>
                <span style={{ color: "#9a9a9a" }}> — {p.blurb}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="hairline"></div>
      <div className="srow"><label>Primary modifier</label>
        <span className="sval" data-platform-modifier>{profile.primaryModifier.name} · {profile.primaryModifier.symbol}</span></div>
      <div className="srow"><label>Platform key</label>
        <span className="sval">{profile.platformKey.name}</span></div>
      <div className="srow"><label>Keyboard layout</label>
        <span className="sval" data-platform-layout>{profile.keyboardLayoutName}</span></div>
      {!origin && (
        <div className="cap" style={{ marginTop: 6 }}>
          Not chosen yet — the Setup Wizard will ask. Until then the environment behaves as {profile.name}.
        </div>
      )}
    </div>
  );
}
