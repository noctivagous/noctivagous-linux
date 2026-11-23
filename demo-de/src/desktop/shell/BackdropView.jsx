/* BackdropView — the parametric backdrop's canvas.
 *
 * Mounted once by the shell, behind both the login screen and the
 * desktop, so one simulation runs continuously across the session
 * boundary. All behaviour lives in services/backdropService.js;
 * this component attaches the canvas and feeds it the current
 * settings and the screen grade (login: slower, darker).
 */

import { useEffect, useRef } from "react";
import { store, useSlice } from "../core/react.js";
import { runBackdrop } from "../services/backdropService.js";

export default function BackdropView() {
  const canvasRef = useRef(null);
  const session = useSlice("session");
  const settings = useSlice("settings");
  const gradeRef = useRef({ speed: 0.5, dim: 0.6 });
  gradeRef.current =
    session.screen === "login" ? { speed: 0.5, dim: 0.6 } : { speed: 1, dim: 1 };

  useEffect(() => {
    if (settings.backdrop.mode !== "parametric" || !canvasRef.current) return undefined;
    return runBackdrop(canvasRef.current, {
      getSettings: () => store.get().settings.backdrop,
      getGrade: () => gradeRef.current,
      subscribe: (fn) => store.subscribe(fn),
    });
  }, [settings.backdrop.mode]);

  if (settings.backdrop.mode !== "parametric") return null;
  return <canvas id="backdropCanvas" ref={canvasRef} aria-hidden="true" />;
}
