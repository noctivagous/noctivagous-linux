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

export { store };
