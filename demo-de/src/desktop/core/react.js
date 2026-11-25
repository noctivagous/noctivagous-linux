/* React binding for the store — components subscribe to exactly
 * the slice they render, via useSyncExternalStore. Actions are
 * plain functions over the store; there is no dispatch ceremony. */

import { useSyncExternalStore } from "react";
import { store } from "./store.js";

export function useSlice(name) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get()[name],
    () => store.get()[name],
  );
}

export function useSetting(key) {
  const settings = useSlice("settings");
  return settings[key];
}

export function setSetting(key, value) {
  store.set("settings", { [key]: value });
}

export function setBackdrop(patch) {
  const cur = store.get().settings.backdrop;
  store.set("settings", { backdrop: { ...cur, ...patch } });
}

export function setGreeter(patch) {
  const cur = store.get().settings.greeter || {};
  store.set("settings", { greeter: { ...cur, ...patch } });
}

export function setPlatform(patch) {
  const cur = store.get().settings.platform || {};
  store.set("settings", { platform: { ...cur, ...patch } });
}

export function setSetup(patch) {
  const cur = store.get().settings.setup || {};
  store.set("settings", { setup: { ...cur, ...patch } });
}

export { store };
