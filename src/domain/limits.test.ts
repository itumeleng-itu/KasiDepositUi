import { SCHEME_MAX_CENTS } from './limits';

describe('SCHEME_MAX_CENTS', () => {
  it('is the R50,000 national PayShap ceiling, in cents', () => {
    expect(SCHEME_MAX_CENTS).toBe(5_000_000);
  });
});
