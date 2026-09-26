import { FULL_NAMES_MAX, normaliseName, validateFullNames, validateName } from './name';

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

describe('validateFullNames', () => {
  it.each(['Thabo Mokoena', 'Nomvula Grace Dlamini', "Zoë O'Neill-Botha", '  Lerato   Mahlangu  '])(
    'accepts %s',
    (names) => {
      expect(validateFullNames(names)).toBeNull();
    },
  );

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['Thabo', 'one_name'],
    ['Thabo -', 'one_name'],
    ['Thabo M0koena', 'invalid_chars'],
    ['Thabo Mokoena!', 'invalid_chars'],
    [`Thabo ${'a'.repeat(FULL_NAMES_MAX)}`, 'too_long'],
  ])('rejects %j as %s', (names, error) => {
    expect(validateFullNames(names)).toBe(error);
  });
});
