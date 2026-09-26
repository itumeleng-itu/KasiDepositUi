import { ApiError } from './api/errors';
import type { Deposit } from './api/types';
import {
  createPoller,
  isTerminal,
  pollDelayMs,
  progressSteps,
  screenState,
  STILL_PROCESSING_AFTER_MS,
} from './polling';

const deposit = (status: Deposit['status'], extra: Partial<Deposit> = {}): Deposit => ({
  id: 'd1',
  reference: 'KD-7F3A9C',
  status,
  payoutCents: 49500,
  ...extra,
});

describe('pollDelayMs', () => {
  it.each([
    [0, 1000],
    [29_999, 1000],
    [30_000, 3000],
    [89_999, 3000],
    [90_000, 5000],
    [10 * 60_000, 5000],
  ])('at %d ms elapsed waits %d ms', (elapsed, expected) => {
    expect(pollDelayMs(elapsed)).toBe(expected);
  });
});

describe('isTerminal', () => {
  it('is true only for completed and failed', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('submitted')).toBe(false);
  });
});

describe('screenState', () => {
  it('shows pending before the first response', () => {
    expect(screenState(null, 0)).toBe('pending');
  });

  it('shows the server status while it is quick', () => {
    expect(screenState('pending', 5_000)).toBe('pending');
    expect(screenState('submitted', 89_999)).toBe('submitted');
  });

  it('says still processing after 90 s without a terminal status, never failed', () => {
    expect(screenState('submitted', STILL_PROCESSING_AFTER_MS)).toBe('still_processing');
    expect(screenState('pending', 5 * 60_000)).toBe('still_processing');
    expect(screenState(null, STILL_PROCESSING_AFTER_MS)).toBe('still_processing');
  });

  it('a terminal status always wins, however slow', () => {
    expect(screenState('completed', 5 * 60_000)).toBe('completed');
    expect(screenState('failed', 5 * 60_000)).toBe('failed');
  });
});

describe('progressSteps', () => {
  it('walks checked, then sent, and stops there', () => {
    expect(progressSteps(null)).toEqual(['current', 'todo']);
    expect(progressSteps('pending')).toEqual(['current', 'todo']);
    expect(progressSteps('submitted')).toEqual(['done', 'current']);
    expect(progressSteps('completed')).toEqual(['done', 'done']);
  });

  it('has no steps for a failed deposit', () => {
    expect(progressSteps('failed')).toBeNull();
  });
});

describe('createPoller', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(overrides: { startedAt?: number; fetchDeposit?: () => Promise<Deposit> } = {}) {
    const fetchDeposit = jest.fn(overrides.fetchDeposit ?? (() => Promise.resolve(deposit('submitted'))));
    const onDeposit = jest.fn();
    const onError = jest.fn();
    const poller = createPoller({
      fetchDeposit,
      onDeposit,
      onError,
      startedAt: overrides.startedAt ?? Date.now(),
    });
    return { poller, fetchDeposit, onDeposit, onError };
  }

  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  it('polls straight away', async () => {
    const { poller, fetchDeposit, onDeposit } = setup();
    poller.start();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    expect(onDeposit).toHaveBeenCalledWith(deposit('submitted'));
    poller.stop();
  });

  it('polls every second for the first 30 seconds, then every 3', async () => {
    const { poller, fetchDeposit } = setup();
    poller.start();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    await advance(29_000); // t = 29 s: one call per second so far
    expect(fetchDeposit).toHaveBeenCalledTimes(30);

    await advance(1_000); // t = 30 s: the last one-second poll
    expect(fetchDeposit).toHaveBeenCalledTimes(31);

    await advance(2_999); // now waiting 3 s between polls
    expect(fetchDeposit).toHaveBeenCalledTimes(31);
    await advance(1);
    expect(fetchDeposit).toHaveBeenCalledTimes(32);
    poller.stop();
  });

  it('picks up at the right point of the schedule when opened after 90 s (5 s polls)', async () => {
    const { poller, fetchDeposit } = setup({ startedAt: Date.now() - 100_000 });
    poller.start();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    await advance(4_999);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchDeposit).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('never has more than one poll in flight', async () => {
    let resolve: (d: Deposit) => void = () => {};
    const { poller, fetchDeposit, onDeposit } = setup({
      fetchDeposit: () => new Promise<Deposit>((r) => (resolve = r)),
    });
    poller.start();
    await advance(60_000); // a minute passes and the request has not come back
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    resolve(deposit('submitted'));
    await advance(0);
    expect(onDeposit).toHaveBeenCalledTimes(1);
    // A minute in, so the next poll follows the 3 s cadence, and only once the last one landed.
    await advance(2_999);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchDeposit).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it.each(['completed', 'failed'] as const)('stops as soon as the status is %s', async (status) => {
    const { poller, fetchDeposit, onDeposit } = setup({
      fetchDeposit: () => Promise.resolve(deposit(status)),
    });
    poller.start();
    await advance(0);
    expect(onDeposit).toHaveBeenCalledTimes(1);

    await advance(10 * 60_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
  });

  it('keeps going after a network error, reporting it without inventing a status', async () => {
    const fetchDeposit = jest
      .fn<Promise<Deposit>, []>()
      .mockRejectedValueOnce(ApiError.network())
      .mockResolvedValue(deposit('submitted'));
    const { poller, onDeposit, onError } = setup({ fetchDeposit });
    poller.start();
    await advance(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDeposit).not.toHaveBeenCalled();

    await advance(1_000);
    expect(onDeposit).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('pauses in the background and resumes with an immediate poll', async () => {
    const { poller, fetchDeposit } = setup();
    poller.start();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    poller.pause();
    await advance(20_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    poller.resume();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(2);
    await advance(1_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(3);
    poller.stop();
  });

  it('a request that lands while paused is applied but does not schedule another', async () => {
    let resolve: (d: Deposit) => void = () => {};
    const { poller, fetchDeposit, onDeposit } = setup({
      fetchDeposit: () => new Promise<Deposit>((r) => (resolve = r)),
    });
    poller.start();
    await advance(0);
    poller.pause();

    resolve(deposit('submitted'));
    await advance(0);
    expect(onDeposit).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('resuming while a request is still in flight does not start a second one', async () => {
    let resolve: (d: Deposit) => void = () => {};
    const { poller, fetchDeposit } = setup({
      fetchDeposit: () => new Promise<Deposit>((r) => (resolve = r)),
    });
    poller.start();
    await advance(0);
    poller.pause();
    poller.resume();
    await advance(5_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    resolve(deposit('submitted'));
    await advance(1_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('stops for good on unmount and ignores a late response', async () => {
    let resolve: (d: Deposit) => void = () => {};
    const { poller, fetchDeposit, onDeposit } = setup({
      fetchDeposit: () => new Promise<Deposit>((r) => (resolve = r)),
    });
    poller.start();
    await advance(0);
    poller.stop();

    resolve(deposit('completed'));
    await advance(60_000);
    expect(onDeposit).not.toHaveBeenCalled();
    expect(fetchDeposit).toHaveBeenCalledTimes(1);

    poller.resume();
    poller.start();
    await advance(60_000);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
  });

  it('can start paused (app opened in the background) and polls on resume', async () => {
    const { poller, fetchDeposit } = setup();
    poller.pause();
    poller.start();
    await advance(10_000);
    expect(fetchDeposit).not.toHaveBeenCalled();

    poller.resume();
    await advance(0);
    expect(fetchDeposit).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});
