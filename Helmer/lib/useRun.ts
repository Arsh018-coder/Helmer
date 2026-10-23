/**
 * lib/useRun.ts — live run data for the run view, the phone view and the replay.
 *
 * AGENTS.md section 2 fixes the transport: the browser polls the run's events every 700 ms with a
 * cursor, so it only ever transfers what is new and it works through any tunnel or venue Wi-Fi
 * without a websocket. This hook owns that loop; the components only render the `AgentRun` it
 * returns.
 *
 * Polling stops as soon as the run reaches a terminal status, and slows to 3 s while it is paused,
 * because a paused run changes only when a human acts on it.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  TERMINAL_RUN_STATUSES,
  getRun,
  listEvents,
  type EventRecord,
  type RunDetail,
  type RunStatus,
} from './api';
import { reduceEvents } from './reduceEvents';
import type { AgentRun } from './types';

/** Cadence while the agent is working: fast enough to feel live, slow enough to be polite. */
const POLL_ACTIVE_MS = 350;
/** Cadence while the run is paused or finished, where nothing changes on its own. */
const POLL_IDLE_MS = 3_000;

export interface UseRunOptions {
  /** Share token for the phone Steer view (`?t=`); the console passes nothing. */
  token?: string | null;
}

export interface UseRunResult {
  /** The run folded from its events; what every run screen renders. */
  run: AgentRun | null;
  /** The run's lifecycle status, straight from the server. */
  status: RunStatus | null;
  /** The raw events, in order — the replay scrubber slices these, and the recorder shows the head. */
  events: EventRecord[];
  /** The run row (contract, plan, budget, verdict) fetched once alongside the events. */
  detail: RunDetail | null;
  loading: boolean;
  error: ApiError | null;
  /** Re-poll from the last cursor immediately (used after a control action is accepted). */
  refresh: () => void;
}

/**
 * Poll one run until it finishes.
 *
 * @param id the run id, or null when no run is selected (the hook then returns an empty result).
 */
export function useRun(id: string | null, options: UseRunOptions = {}): UseRunResult {
  const token = options.token ?? null;

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // Ticks on every poll so the live duration and time budget keep counting even between events.
  const [now, setNow] = useState(() => Date.now());
  const lastSeqRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const cancelledRef = useRef(false);

  const poll = useCallback(async (): Promise<void> => {
    if (!id || cancelledRef.current || isPollingRef.current) return;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = true;

    try {
      const page = await listEvents(id, lastSeqRef.current, token);
      if (cancelledRef.current) return;

      if (page.events.length > 0) {
        lastSeqRef.current = page.events[page.events.length - 1].seq;
        setEvents((previous) => [...previous, ...page.events]);
      }
      setStatus(page.status);
      setError(null);
      setLoading(false);
      if (page.status !== 'paused') {
        setNow(Date.now());
      }

      if (!TERMINAL_RUN_STATUSES.includes(page.status)) {
        pollTimerRef.current = setTimeout(poll, page.status === 'paused' ? POLL_IDLE_MS : POLL_ACTIVE_MS);
      }
    } catch (cause) {
      if (cancelledRef.current) return;
      setError(
        cause instanceof ApiError ? cause : new ApiError(0, 'network', 'The run could not be polled.'),
      );
      setLoading(false);
      pollTimerRef.current = setTimeout(poll, POLL_IDLE_MS);
    } finally {
      isPollingRef.current = false;
    }
  }, [id, token]);

  const refresh = useCallback(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!id) {
      lastSeqRef.current = 0;
      setEvents([]);
      setStatus(null);
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    // A fresh run starts from an empty timeline and beginning of chain
    lastSeqRef.current = 0;
    setEvents([]);
    setStatus(null);
    setDetail(null);
    setError(null);
    setLoading(true);

    getRun(id, token)
      .then((value) => {
        if (!cancelledRef.current) setDetail(value);
      })
      .catch((cause: unknown) => {
        if (!cancelledRef.current && cause instanceof ApiError && cause.status !== 404) setError(cause);
      });

    void poll();

    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [id, token, poll]);

  const run = useMemo(() => {
    if (!id) return null;
    return reduceEvents(id, events, {
      status: status ?? undefined,
      verdict: detail?.verdict ?? null,
      now,
    });
  }, [id, events, status, detail, now]);

  return { run, status, events, detail, loading, error, refresh };
}
