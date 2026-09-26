/**
 * Status polling rules, kept free of React and Expo so they can be unit-tested with fake timers.
 *
 *  - every 1 s for the first 30 s, then every 3 s
 *  - after 90 s with no terminal status the screen says "still processing" and polls every 5 s
 *    (slow is not failed: we never show "failed" just because it is taking a while)
 *  - stop on a terminal status; pause in the background and resume on return
 *  - never more than one poll in flight
 *
 * Elapsed time is measured from when the deposit was created, so a screen opened cold after the
 * app was closed picks up at the right point of the schedule.
 */
import type { Deposit, DepositStatus } from './api/types';
import type { StatusScreenState } from './copy';

export const FAST_POLL_UNTIL_MS = 30_000;
export const STILL_PROCESSING_AFTER_MS = 90_000;
const FAST_POLL_MS = 1_000;
const NORMAL_POLL_MS = 3_000;
const SLOW_POLL_MS = 5_000;

export function isTerminal(status: DepositStatus): boolean {
  return status === 'completed' || status === 'failed';
}

/** How long to wait before the next poll, given how long ago the deposit was created. */
export function pollDelayMs(elapsedMs: number): number {
  if (elapsedMs < FAST_POLL_UNTIL_MS) return FAST_POLL_MS;
  if (elapsedMs < STILL_PROCESSING_AFTER_MS) return NORMAL_POLL_MS;
  return SLOW_POLL_MS;
}

/** What the screen should say. `status` is null until the first response arrives. */
export function screenState(status: DepositStatus | null, elapsedMs: number): StatusScreenState {
  if (status !== null && isTerminal(status)) return status;
  if (elapsedMs >= STILL_PROCESSING_AFTER_MS) return 'still_processing';
  return status ?? 'pending';
}

export type StepState = 'done' | 'current' | 'todo';

/**
 * The stepped indicator across the happy path: checked, sent, arrived. Null for a failed deposit,
 * which is not on that path.
 */
export function progressSteps(status: DepositStatus | null): [StepState, StepState, StepState] | null {
  switch (status) {
    case null:
    case 'pending':
      return ['current', 'todo', 'todo'];
    case 'submitted':
      return ['done', 'done', 'current'];
    case 'completed':
      return ['done', 'done', 'done'];
    case 'failed':
      return null;
  }
}

export interface PollerOptions {
  fetchDeposit: () => Promise<Deposit>;
  onDeposit: (deposit: Deposit) => void;
  onError: (error: unknown) => void;
  /** Epoch ms when the deposit was created. */
  startedAt: number;
  now?: () => number;
}

export interface Poller {
  /** Polls straight away, then on the schedule. */
  start(): void;
  /** Background: cancel the next poll. A request already in flight still finishes. */
  pause(): void;
  /** Foreground: poll straight away and carry on. */
  resume(): void;
  /** Done (unmounted): nothing more is delivered. */
  stop(): void;
}

export function createPoller(options: PollerOptions): Poller {
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let paused = false;
  let stopped = false;
  let started = false;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule() {
    clearTimer();
    if (stopped || paused) return;
    timer = setTimeout(tick, pollDelayMs(now() - options.startedAt));
  }

  async function tick() {
    timer = null;
    if (stopped || paused || inFlight) return;

    inFlight = true;
    try {
      const deposit = await options.fetchDeposit();
      if (stopped) return;
      options.onDeposit(deposit);
      if (isTerminal(deposit.status)) {
        stop();
        return;
      }
    } catch (error) {
      if (stopped) return;
      // A failed poll changes nothing on screen beyond the caller's "no connection" note.
      options.onError(error);
    } finally {
      inFlight = false;
    }
    schedule();
  }

  function stop() {
    stopped = true;
    clearTimer();
  }

  return {
    start() {
      if (started || stopped) return;
      started = true;
      void tick();
    },
    pause() {
      paused = true;
      clearTimer();
    },
    resume() {
      if (stopped || !paused) return;
      paused = false;
      // If a request is still in flight it schedules the next poll when it lands.
      if (!inFlight) {
        clearTimer();
        void tick();
      }
    },
    stop,
  };
}
