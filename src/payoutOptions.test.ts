import type { PayoutMethod } from './api/types';
import { MAX_PAYOUT_METHODS, payoutOptions } from './payoutOptions';

const shapId = (id: string): PayoutMethod =>
  ({ id, kind: 'shapId', shapId: '+27821234560', shapName: 'T. Mokoena', bankId: 'capitec', isDefault: false }) as PayoutMethod;

const account = (id: string): PayoutMethod =>
  ({ id, kind: 'account', name: 'T Mokoena', accountLast4: '4560', bankId: 'capitec', isDefault: false }) as PayoutMethod;

describe('which ways of being paid to offer', () => {
  it('offers both to someone with none', () => {
    expect(payoutOptions([])).toEqual({ payShap: true, account: true, full: false });
  });

  it('stops offering PayShap once there is one', () => {
    // Your number is your number: a second is almost always a mistake.
    expect(payoutOptions([shapId('a')]).payShap).toBe(false);
  });

  it('keeps offering bank accounts, because more than one is ordinary', () => {
    expect(payoutOptions([account('a'), account('b')]).account).toBe(true);
  });

  it('still offers PayShap to someone with only bank accounts', () => {
    expect(payoutOptions([account('a'), account('b')]).payShap).toBe(true);
  });

  it('offers nothing at the server cap', () => {
    // Past MAX_METHODS the server refuses the add, and a refusal the
    // user could not have predicted reads as a fault, not a limit.
    const many = Array.from({ length: MAX_PAYOUT_METHODS }, (_, i) => account(`a${i}`));
    expect(payoutOptions(many)).toEqual({ payShap: false, account: false, full: true });
  });

  it('is full at the cap even if none of them is a PayShap number', () => {
    const many = Array.from({ length: MAX_PAYOUT_METHODS }, (_, i) => account(`a${i}`));
    expect(payoutOptions(many).payShap).toBe(false);
  });

  it('matches the cap the API enforces', () => {
    // MAX_METHODS in the API's app/payout_methods.py. If that moves,
    // this is the test that should fail.
    expect(MAX_PAYOUT_METHODS).toBe(5);
  });
});
