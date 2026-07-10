/**
 * agent-activity-model — the state reducer behind AgentActivityView.
 *
 * Live AI Visibility plan (live-ai-visibility-event-relay.md) step 3.1. Turns the
 * ordered OpenCode event stream (relayed by /api/ai/stream) into an ordered list
 * of renderable "parts" plus connection/generation status. All rendering logic
 * lives here as plain, unit-testable TypeScript; AgentActivityView.svelte is a
 * thin view that replays events through this and paints the result.
 *
 * Constraint 9 (snapshot reconciliation): `message.part.delta` events APPEND to a
 * part's text (smooth streaming); `message.part.updated` snapshots REPLACE the
 * whole part's text (snapshots win). Because every part in a turn ends with a
 * full-text snapshot, the final render converges to the snapshots alone — so a
 * stream that drops every delta (reconnect gap) still renders byte-identically.
 * This is what makes the bus-gap self-healing and is proven by the lossy-fixture
 * test.
 */

import type { OpencodeEvent } from './server/opencode-events';

export type Role = 'user' | 'assistant' | 'system' | 'unknown';
export type ConnStatus = 'connecting' | 'busy' | 'idle';

export interface ActivityPart {
  id: string;
  messageID: string | null;
  role: Role;
  /** text | reasoning | step-start | step-finish | tool */
  type: string;
  text: string;
  /** tool name (type === 'tool') */
  tool?: string;
  /** tool lifecycle: pending | running | completed | error */
  toolState?: string;
}

export interface ActivityState {
  status: ConnStatus;
  /** true after a bus-gap until the next snapshot reconciles the stream */
  busGap: boolean;
  /** non-null when the stream reported an error */
  error: string | null;
  /** parts in first-seen order */
  parts: ActivityPart[];
}

interface InternalPart extends ActivityPart {
  messageID: string | null;
}

export interface ActivityModel {
  apply(event: OpencodeEvent): void;
  state(): ActivityState;
  reset(): void;
}

export function createActivityModel(): ActivityModel {
  let status: ConnStatus = 'connecting';
  let busGap = false;
  let error: string | null = null;
  const roles = new Map<string, Role>(); // messageID -> role
  const parts: InternalPart[] = [];
  const index = new Map<string, number>(); // partID -> parts idx

  function roleOf(messageID: string | null | undefined): Role {
    if (!messageID) return 'unknown';
    return roles.get(messageID) ?? 'unknown';
  }

  function upsertSnapshot(part: Record<string, any>): void {
    const id = part?.id;
    if (typeof id !== 'string') return;
    const snapshot = {
      type: typeof part.type === 'string' ? part.type : 'text',
      text: typeof part.text === 'string' ? part.text : '',
      messageID: typeof part.messageID === 'string' ? part.messageID : null,
      tool: typeof part.tool === 'string' ? part.tool : undefined,
      toolState: typeof part.state?.status === 'string' ? part.state.status : undefined,
    };
    const at = index.get(id);
    if (at === undefined) {
      parts.push({ id, role: 'unknown', ...snapshot });
      index.set(id, parts.length - 1);
    } else {
      // Snapshot wins — replace text and metadata wholesale (Constraint 9).
      const p = parts[at];
      p.type = snapshot.type;
      p.text = snapshot.text;
      if (snapshot.messageID) p.messageID = snapshot.messageID;
      p.tool = snapshot.tool ?? p.tool;
      p.toolState = snapshot.toolState ?? p.toolState;
    }
    // A fresh snapshot means the stream is reconciled again.
    busGap = false;
  }

  function appendDelta(partID: string | undefined, field: string | undefined, delta: string | undefined): void {
    if (typeof partID !== 'string' || field !== 'text' || typeof delta !== 'string') return;
    const at = index.get(partID);
    if (at === undefined) {
      // delta before its snapshot — start a provisional text part
      parts.push({ id: partID, role: 'unknown', messageID: null, type: 'text', text: delta });
      index.set(partID, parts.length - 1);
    } else {
      parts[at].text += delta;
    }
  }

  function apply(event: OpencodeEvent): void {
    const p = (event?.properties ?? {}) as Record<string, any>;
    switch (event?.type) {
      case 'bus-gap':
        busGap = true;
        break;
      case 'session.status': {
        const t = p.status?.type;
        if (t === 'busy' || t === 'idle') status = t;
        break;
      }
      case 'session.idle':
        status = 'idle';
        break;
      case 'session.error':
      case 'error':
        error = typeof p.message === 'string' ? p.message : 'stream error';
        break;
      case 'message.updated': {
        const info = p.info;
        if (info && typeof info.id === 'string') roles.set(info.id, (info.role as Role) ?? 'unknown');
        break;
      }
      case 'message.part.updated':
        if (status === 'connecting') status = 'busy';
        upsertSnapshot(p.part ?? {});
        break;
      case 'message.part.delta':
        if (status === 'connecting') status = 'busy';
        appendDelta(p.partID, p.field, p.delta);
        break;
      default:
        break; // session.updated, session.diff, server.*, etc. — not rendered
    }
  }

  function state(): ActivityState {
    return {
      status,
      busGap,
      error,
      parts: parts.map((p) => ({
        id: p.id,
        messageID: p.messageID,
        role: roleOf(p.messageID),
        type: p.type,
        text: p.text,
        tool: p.tool,
        toolState: p.toolState,
      })),
    };
  }

  function reset(): void {
    status = 'connecting';
    busGap = false;
    error = null;
    roles.clear();
    parts.length = 0;
    index.clear();
  }

  return { apply, state, reset };
}

/** Replay a whole event list through a fresh model (pure; used by the Svelte view). */
export function reduceEvents(events: OpencodeEvent[]): ActivityState {
  const m = createActivityModel();
  for (const e of events) m.apply(e);
  return m.state();
}

// --- Convenience selectors (view + tests) -----------------------------------

/** Concatenated text of a role's text parts, in order. */
export function textFor(state: ActivityState, role: Role): string {
  return state.parts.filter((p) => p.type === 'text' && p.role === role).map((p) => p.text).join('');
}

/** Concatenated reasoning text (any role), in order. */
export function reasoningText(state: ActivityState): string {
  return state.parts.filter((p) => p.type === 'reasoning').map((p) => p.text).join('');
}

/**
 * Assistant answer text grouped by message, in first-seen order — one string per
 * assistant message (turn). Used to pull structured multi-turn output (e.g. the
 * live Improve flow: turn 0 = improved body, turn 1 = critique) back out of the
 * streamed event log for the downstream Apply step.
 */
export function assistantMessageTexts(state: ActivityState): string[] {
  const order: string[] = [];
  const byMsg = new Map<string, string>();
  for (const p of state.parts) {
    if (p.type !== 'text' || p.role !== 'assistant') continue;
    const key = p.messageID ?? p.id;
    if (!byMsg.has(key)) {
      byMsg.set(key, '');
      order.push(key);
    }
    byMsg.set(key, byMsg.get(key)! + p.text);
  }
  return order.map((k) => byMsg.get(k)!);
}
