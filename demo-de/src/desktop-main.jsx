/* NCT Desktop — entry point.
 * The root page is a React app (see DESKTOP-ARCHITECTURE.md):
 * shell/DesktopApp is the composition root; core/ holds the store,
 * bus and registry; services/ the engines; apps/ the applications;
 * src/keyclicks/ the framework-free bimodal input subsystem. */
import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/nct-desktop.css";
import "../styles/keyclicks.css";
import DesktopApp from "./desktop/shell/DesktopApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
);
