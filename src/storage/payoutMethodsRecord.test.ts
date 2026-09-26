import type { PayoutMethod } from '../api/types';
import {
  defaultMethod,
  PAYOUT_METHODS_KEY,
  parsePayoutMethods,
  serialisePayoutMethods,
} from './payoutMethodsRecord';

const shap: PayoutMethod = {
  id: 'pm-1',
  isDefault: false,
  kind: 'shapId',
  shapId: '+27825551234',
  shapName: 'T. Mokoena',
  bankId: 'fnb',
};

const account: PayoutMethod = {
  id: 'pm-2',
  isDefault: true,
  kind: 'account',
  name: 'Thabo Mokoena',
  accountLast4: '4417',
  bankId: 'capitec',
};

describe('payout methods record', () => {
  it('uses the v1 key', () => {
    expect(PAYOUT_METHODS_KEY).toBe('kd.payoutMethods.v1');
  });

  it('round-trips both kinds', () => {
    expect(parsePayoutMethods(serialisePayoutMethods([shap, account]))).toEqual([shap, account]);
  });

  it('never holds a full account number', () => {
    const withNumber = { ...account, accountNumber: '1234564417' } as PayoutMethod;
    expect(parsePayoutMethods(serialisePayoutMethods([withNumber]))).toEqual([account]);
  });

  it('drops unreadable entries and reads a broken record as empty', () => {
    const raw = JSON.stringify({ version: 1, methods: [shap, { ...account, id: '' }, { id: 'x' }] });
    expect(parsePayoutMethods(raw)).toEqual([shap]);
    expect(parsePayoutMethods('{')).toEqual([]);
    expect(parsePayoutMethods(JSON.stringify({ version: 2, methods: [shap] }))).toEqual([]);
  });

  it('pays into the default, or the first if none is marked', () => {
    expect(defaultMethod([shap, account])).toBe(account);
    expect(defaultMethod([shap])).toBe(shap);
    expect(defaultMethod([])).toBeNull();
  });
});
