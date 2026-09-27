/**
 * The privacy notice's version and the Information Officer's contact.
 *
 * Bump PRIVACY_NOTICE_VERSION whenever the notice's substance changes (what is collected, why,
 * who it is shared with, how long it is kept). Registration sends it, so the server can record
 * which notice each user agreed to.
 */
export const PRIVACY_NOTICE_VERSION = '2026-09-27';

/**
 * How to reach KasiDeposit's Information Officer (POPIA section 55). NOT YET CONFIRMED: null
 * until the business supplies real details; the privacy screen then says they are to follow
 * rather than showing an invented address.
 */
export const INFORMATION_OFFICER_CONTACT: string | null = null;
