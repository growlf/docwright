/**
 * ai-presence — pure aggregator that turns the raw /event stream into a
 * per-user "is any AI working" signal for the toolbar presence chip (live-ai
 * 3.6; absorbs the deferred External AI Watcher Presence Indicator). Ownership
 * is injected so it is unit-testable without the registry.
 */

import type { OpencodeEvent } from './opencode-events';

export interface Presence {
  busy: boolean;
  count: number; // number of the user's sessions currently generating
}

export interface PresenceTracker {
  /** Apply a bus event; returns true iff the presence snapshot changed. */
  apply(event: OpencodeEvent): boolean;
  snapshot(): Presence;
}

export function createPresenceTracker(isOwned: (sessionID: string) => boolean): PresenceTracker {
  const busy = new Set<string>();
  return {
    apply(event) {
      const sid = event?.properties?.sessionID;
      if (typeof sid !== 'string' || !isOwned(sid)) return false;
      const before = busy.size;
      if (event.type === 'session.status') {
        const t = (event.properties as { status?: { type?: string } })?.status?.type;
        if (t === 'busy') busy.add(sid);
        else if (t === 'idle') busy.delete(sid);
        else return false;
      } else if (event.type === 'session.idle') {
        busy.delete(sid);
      } else {
        return false;
      }
      return busy.size !== before;
    },
    snapshot() {
      return { busy: busy.size > 0, count: busy.size };
    },
  };
}
