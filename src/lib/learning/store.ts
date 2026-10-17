import { emptyProfile } from "./learn";
import { PROFILE_VERSION, type Profile } from "./types";

/**
 * Where the profile lives. In the web app that's this browser's localStorage: nothing is sent
 * to a server. Real sessions and simulated ones (practice sentences, the simulated sessions in
 * "What Cue has learned") are kept under different keys, so a simulation never teaches Cue
 * anything about the wearer's real speech.
 */

export interface MemoryStore {
  load(): Profile;
  save(p: Profile): void;
  clear(): void;
}

export const STORAGE_KEY = { real: "cue.learning.v1", sandbox: "cue.learning.sandbox.v1" } as const;

/** Bring an older saved profile up to the current shape (there's only version 1 so far). */
export function migrate(raw: unknown, now: string): Profile {
  if (!raw || typeof raw !== "object") return emptyProfile(now);
  const p = raw as Partial<Profile>;
  if (p.version !== PROFILE_VERSION || !Array.isArray(p.sessions)) return emptyProfile(now);
  // Fill anything a later version added with its empty value.
  return { ...emptyProfile(p.createdAt ?? now), ...p } as Profile;
}

export function localStore(key: string, storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): MemoryStore {
  return {
    load() {
      try {
        const text = storage.getItem(key);
        return migrate(text ? JSON.parse(text) : null, new Date().toISOString());
      } catch {
        return emptyProfile(new Date().toISOString());
      }
    },
    save(p) {
      try {
        storage.setItem(key, JSON.stringify(p));
      } catch {
        // Storage blocked or full: learning lasts until the page closes.
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        // Storage blocked.
      }
    },
  };
}

/** A store in memory, for tests. */
export function memoryStore(): MemoryStore & { raw: () => string | null } {
  let text: string | null = null;
  return {
    load: () => migrate(text ? JSON.parse(text) : null, new Date().toISOString()),
    save: (p) => {
      text = JSON.stringify(p);
    },
    clear: () => {
      text = null;
    },
    raw: () => text,
  };
}
