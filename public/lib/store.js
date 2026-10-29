// Keeps progress on the phone for now. Cloud sync (its own Cloudflare storage,
// behind a passcode) replaces the inside of this file in build step 3; the rest
// of the app only calls load() and save().

import { emptyState } from "./progress.js";

const KEY = "octave:v1";

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return emptyState();
    return { ...emptyState(), ...data };
  } catch {
    return emptyState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
