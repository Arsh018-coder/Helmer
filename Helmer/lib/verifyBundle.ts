/**
 * lib/verifyBundle.ts — the offline verifier's logic (feature F1).
 *
 * The strongest answer to "why should I trust your log?" is to not ask for trust: `/verify` takes
 * an exported bundle and re-checks the hash chain **in the browser**, with WebCrypto, using the
 * same formula the server recorded with. Nothing here talks to our API. The only thing it trusts
 * is a head hash the user pasted from somewhere outside our database — a slide, a phone, a
 * message — which is what turns "the chain is intact" into "the chain is the one that was
 * published".
 *
 * This module is the boundary: it validates the pasted JSON into a `RunBundle` and hands the
 * checks to `lib/chain.ts`. Keeping it separate means the page component holds no verification
 * logic of its own.
 */

import { verifyChain, type ChainEvent } from './chain';

/** One event as it appears in an exported bundle; structurally `lib/chain.ts`'s `ChainEvent`. */
export type BundleEvent = ChainEvent;

/** The export produced by `GET /api/runs/[id]/bundle` and consumed by `/verify`. */
export interface RunBundle {
  runId: string;
  events: BundleEvent[];
  /** The head hash the exporting server reported, for convenience only — never trusted. */
  head: string;
}

/** What the verifier concluded, in the words the page shows. */
export interface BundleVerdict {
  /** True when every link of the chain recomputed correctly. */
  ok: boolean;
  /** Sequence number of the first event whose hash did not match, or null when intact. */
  brokenAt: number | null;
  /** The head hash this browser computed from the events. */
  computedHead: string;
  /** The head hash the user pinned from outside the database, when they supplied one. */
  pinnedHead: string | null;
  /** True when a pinned head exists and equals the computed head. */
  headMatches: boolean;
  eventCount: number;
  /** A short, honest sentence for the result panel. */
  message: string;
}

const HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Parse pasted bundle text into a `RunBundle`.
 *
 * @throws Error with a readable message when the text is not JSON or not a bundle, so the page can
 *         show why the paste was rejected rather than silently verifying nothing.
 */
export function parseBundle(text: string): RunBundle {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('That is not valid JSON. Paste the whole bundle exported by Export bundle.');
  }

  if (value === null || typeof value !== 'object') {
    throw new Error('A bundle must be a JSON object with runId, events and head.');
  }

  const record = value as Record<string, unknown>;
  const runId = record.runId;
  const events = record.events;

  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('The bundle is missing its runId.');
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('The bundle has no events to verify.');
  }

  const parsedEvents: BundleEvent[] = events.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const valid =
      typeof item.seq === 'number' &&
      typeof item.ts === 'number' &&
      typeof item.type === 'string' &&
      typeof item.payload === 'string' &&
      typeof item.prevHash === 'string' &&
      typeof item.hash === 'string';

    if (!valid) throw new Error(`Event ${index} is missing one of seq, ts, type, payload, prevHash, hash.`);

    return {
      seq: item.seq as number,
      ts: item.ts as number,
      type: item.type as string,
      payload: item.payload as string,
      prevHash: item.prevHash as string,
      hash: item.hash as string,
    };
  });

  return {
    runId,
    events: parsedEvents,
    head: typeof record.head === 'string' ? record.head : '',
  };
}

/**
 * Re-check a bundle's chain, and against a pinned head when one was supplied.
 *
 * A pinned head that does not match is reported separately from a broken chain: the chain can be
 * perfectly intact while still not being the one that was published, which is exactly the case the
 * pinning defends against.
 */
export async function verifyBundle(
  bundle: RunBundle,
  pinnedHead?: string | null,
): Promise<BundleVerdict> {
  const pinned = pinnedHead && pinnedHead.trim().length > 0 ? pinnedHead.trim().toLowerCase() : null;

  if (pinned !== null && !HASH_PATTERN.test(pinned)) {
    throw new Error('A pinned head hash must be 64 lowercase hex characters.');
  }

  const verdict = await verifyChain(bundle.runId, bundle.events);
  const eventCount = bundle.events.length;

  if (!verdict.ok) {
    return {
      ok: false,
      brokenAt: verdict.brokenAt,
      computedHead: verdict.head,
      pinnedHead: pinned,
      headMatches: false,
      eventCount,
      message: `Chain broken at event ${verdict.brokenAt}. A stored event was changed after it was recorded.`,
    };
  }

  if (pinned === null) {
    return {
      ok: true,
      brokenAt: null,
      computedHead: verdict.head,
      pinnedHead: null,
      headMatches: false,
      eventCount,
      message: `Chain intact across ${eventCount} events. Pin the head hash from outside this database to rule out a full re-write.`,
    };
  }

  const headMatches = pinned === verdict.head;
  return {
    ok: headMatches,
    brokenAt: null,
    computedHead: verdict.head,
    pinnedHead: pinned,
    headMatches,
    eventCount,
    message: headMatches
      ? `Chain intact and the head hash matches the one you pinned, across ${eventCount} events.`
      : 'Chain intact, but the head hash does not match the one you pinned: this log was recomputed after it was published.',
  };
}
