import { describeDestination, type StoredDestination } from './destination';

const shapIdDestination: StoredDestination = {
  kind: 'shapId',
  shapId: '+27821234567',
  shapName: 'M. Mothiba',
  bankId: 'capitec',
};

const accountDestination: StoredDestination = {
  kind: 'account',
  name: 'Thabo Mokoena',
  accountNumber: '1234564417',
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
});
