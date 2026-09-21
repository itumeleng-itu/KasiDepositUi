import { normaliseName, validateName } from './name';

describe('normaliseName', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normaliseName('  Thabo   Mokoena ')).toBe('Thabo Mokoena');
    expect(normaliseName('Thabo\t\nMokoena')).toBe('Thabo Mokoena');
  });
});

describe('validateName', () => {
  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['A', 'too_short'],
    ['Al', null],
    ['Thabo Mokoena', null],
    ["Ma'ame Nkosi-Dlamini", null],
    ['Ma’ame', null],
    ['Zoë Müller', null],
    ['Zoë Müller', null],
    ['Thabo 2', 'invalid_chars'],
    ['Thabo_M', 'invalid_chars'],
    ['-Thabo', 'invalid_chars'],
    ['a'.repeat(60), null],
    ['a'.repeat(61), 'too_long'],
  ])('validates %j -> %s', (input, expected) => {
    expect(validateName(input)).toBe(expected);
  });
});
