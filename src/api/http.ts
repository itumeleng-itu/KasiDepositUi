import { currentAccessToken } from '../storage/user';
import { ApiError } from './errors';
import type { ApiClient } from './client';
import {
  destinationToWire,
  interpretErrorResponse,
  parseDeposit,
  parseDepositHistory,
  parseRegisteredUser,
  parseResolvedShapId,
  parseVoucherLookup,
  registrationToWire,
} from './wire';

const TIMEOUT_MS = 15_000;

function baseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    // A configuration mistake, not something the user did. Fail loudly in development.
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }
  return url.replace(/\/+$/, '');
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** Send the signed-in user's token, if there is one. Off only for registering. */
  auth?: boolean;
}

/**
 * One request with a 15 s timeout. Anything that stops us getting a full response (offline,
 * DNS, timeout, aborted body) is a 'network' error; the caller never sees the raw failure,
 * which could contain the PIN or ID number from the request body.
 */
async function request(method: 'GET' | 'POST', path: string, options: RequestOptions = {}) {
  const url = `${baseUrl()}${path}`;
  const token = options.auth === false ? null : await currentAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let status: number;
  let text: string;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    status = response.status;
    text = await response.text();
  } catch {
    throw ApiError.network();
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }

  if (status < 200 || status >= 300) throw interpretErrorResponse(status, body);
  return body;
}

export const httpApi: ApiClient = {
  async lookupVoucher(pin) {
    const body = await request('POST', '/vouchers/lookup', { body: { pin } });
    return parseVoucherLookup(body);
  },

  async resolveShapId(shapId) {
    // encodeURIComponent turns '+' into %2B and '@' into %40, so both survive the request.
    const body = await request('GET', `/shapid/${encodeURIComponent(shapId)}`);
    return parseResolvedShapId(body);
  },

  async createDeposit(voucherToken, destination, idempotencyKey) {
    const body = await request('POST', '/deposits', {
      body: { voucher_token: voucherToken, destination: destinationToWire(destination) },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return parseDeposit(body);
  },

  async getDepositStatus(id) {
    const body = await request('GET', `/deposits/${encodeURIComponent(id)}`);
    return parseDeposit(body);
  },

  async registerUser(registration) {
    // A fresh registration must not carry an old, possibly revoked, token.
    const body = await request('POST', '/users', { body: registrationToWire(registration), auth: false });
    return parseRegisteredUser(body);
  },

  async listMyDeposits() {
    const body = await request('GET', '/me/deposits');
    return parseDepositHistory(body);
  },
};
