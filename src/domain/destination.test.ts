import { describeDestination, parseStoredDestination, type StoredDestination } from './destination';

const shapIdDestination: StoredDestination = {
  kind: 'shapId',
  shapId: '+27821234567',
  shapName: 'M. Mothiba',
  bankId: 'capitec',
};

const accountDestination: StoredDestination = {
  kind: 'account',
  name: 'Thabo Mokoena',
  accountLast4: '4417',
  bankId: 'capitec',
};

describe('describeDestination: shapId', () => {
  it('shows the scheme name as primary', () => {
    expect(describeDestination(shapIdDestination).primary).toBe('M. Mothiba');
  });

  it('never expands or reformats the scheme name', () => {
    const odd: StoredDestination = { ...shapIdDestination, shapName: '*** M*****' };
    expect(describeDestination(odd).primary).toBe('*** M*****');
  });

  it('secondary is the bank and the masked number', () => {
    expect(describeDestination(shapIdDestination).secondary).toBe('Capitec · ••• ••• 4567');
  });

  it('oneLine is the local number then the bank', () => {
    expect(describeDestination(shapIdDestination).oneLine).toBe('082 123 4567 · Capitec');
  });

  it('spokenOneLine is the local number read naturally, with no separator to trip up a screen reader', () => {
    expect(describeDestination(shapIdDestination).spokenOneLine).toBe('082 123 4567 at Capitec');
  });

  it('drops the @suffix from both renderings', () => {
    const qualified: StoredDestination = { ...shapIdDestination, shapId: '+27821234567@fnb' };
    expect(describeDestination(qualified).oneLine).toBe('082 123 4567 · Capitec');
    expect(describeDestination(qualified).secondary).toBe('Capitec · ••• ••• 4567');
  });
});

describe('describeDestination: account', () => {
  it('shows the account holder name as primary', () => {
    expect(describeDestination(accountDestination).primary).toBe('Thabo Mokoena');
  });

  it('secondary is the bank and the masked account number', () => {
    expect(describeDestination(accountDestination).secondary).toBe('Capitec · ••••4417');
  });

  it('oneLine is the masked account number then the bank', () => {
    expect(describeDestination(accountDestination).oneLine).toBe('••••4417 · Capitec');
  });

  it('spokenOneLine never reads the mask bullets aloud', () => {
    expect(describeDestination(accountDestination).spokenOneLine).toBe('account ending 4417 at Capitec');
  });
});

describe('parseStoredDestination: shapId', () => {
  it('accepts a valid record', () => {
    expect(parseStoredDestination(shapIdDestination)).toEqual(shapIdDestination);
  });

  it('accepts a bank-qualified ShapID', () => {
    const qualified = { ...shapIdDestination, shapId: '+27821234567@fnb' };
    expect(parseStoredDestination(qualified)).toEqual(qualified);
  });

  it.each([
    ['an invalid ShapID', { ...shapIdDestination, shapId: 'not a number' }],
    ['a ShapID that is not canonical E.164', { ...shapIdDestination, shapId: '0821234567' }],
    ['an empty scheme name', { ...shapIdDestination, shapName: '' }],
    ['a missing scheme name', { kind: 'shapId', shapId: '+27821234567', bankId: 'capitec' }],
    ['an unknown bank', { ...shapIdDestination, bankId: 'not_a_bank' }],
  ])('rejects %s', (_label, value) => {
    expect(parseStoredDestination(value)).toBeNull();
  });
});

describe('parseStoredDestination: account', () => {
  it('accepts a valid record', () => {
    expect(parseStoredDestination(accountDestination)).toEqual(accountDestination);
  });

  it.each([
    ['an empty name', { ...accountDestination, name: ' ' }],
    ['more than the last four digits', { ...accountDestination, accountLast4: '1234564417' }],
    ['non-digits', { ...accountDestination, accountLast4: '44a7' }],
    ['a full account number instead', { ...accountDestination, accountLast4: undefined, accountNumber: '1234564417' }],
    ['an unknown bank', { ...accountDestination, bankId: 'not_a_bank' }],
  ])('rejects %s', (_label, value) => {
    expect(parseStoredDestination(value)).toBeNull();
  });
});

describe('parseStoredDestination: neither kind', () => {
  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['an unrecognised kind', { kind: 'crypto', address: '0x0' }],
    ['a missing kind', { name: 'Thabo Mokoena' }],
  ])('rejects %s', (_label, value) => {
    expect(parseStoredDestination(value)).toBeNull();
  });
});
