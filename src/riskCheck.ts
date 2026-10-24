import { isApiError } from './api/errors';
import type { CreateDepositOptions } from './api/types';

/**
 * The confirm screen's three states once the server has a say about risk:
 *   review      the usual "Check before you deposit"
 *   risk_check  the server answered confirmation_required: ask whether anyone told the user to
 *               do this. Nothing has been charged.
 *   stopped     the user chose Stop and get help. Nothing has been charged.
 *
 * The server never says why it asked, and neither does the app: no score, no rule.
 */
export type ConfirmStep = 'review' | 'risk_check' | 'stopped';

/** Whether a failed Send means "ask the risk question" rather than "show an error". */
export function needsRiskCheck(error: unknown): boolean {
  return isApiError(error) && error.kind === 'business' && error.reason === 'confirmation_required';
}

/**
 * What a Send passes to `createDeposit`. Once the user has chosen Continue, every later attempt
 * for this voucher (a retry after no signal, say) carries the acknowledgement, with the same
 * idempotency key, so they are never asked twice for the same deposit.
 */
export function depositOptions(acknowledged: boolean): CreateDepositOptions {
  return acknowledged ? { riskAcknowledged: true } : {};
}
