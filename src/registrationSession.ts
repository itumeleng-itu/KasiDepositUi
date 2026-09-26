/**
 * The details typed on the register screen, held in memory only while the PayShap number is
 * checked and confirmed on the setup screen. Never written to disk and never put in a route
 * param (the ID number would end up in navigation state and logs). Cleared once registering
 * succeeds; lost on reload, which just means the register screen is shown again.
 *
 * Pure (no Expo imports) so it can be unit-tested.
 */

export interface PendingRegistration {
  fullNames: string;
  idNumber: string;
  /** E.164, as `parseShapId` produced it. What the setup screen checks first. */
  shapId: string;
}

let pending: PendingRegistration | null = null;

export function startRegistration(details: PendingRegistration): void {
  pending = { ...details };
}

export function currentRegistration(): PendingRegistration | null {
  return pending;
}

export function clearRegistration(): void {
  pending = null;
}
