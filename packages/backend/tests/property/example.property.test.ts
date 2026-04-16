/**
 * Example property-based test to verify fast-check configuration
 * Feature: po-ai, Property Example: Configuration Test
 */
import fc from 'fast-check';

describe('Property-Based Testing Setup', () => {
  it('should have fast-check configured correctly', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n;
      }),
      { numRuns: 100 }
    );
  });

  it('should generate arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return typeof s === 'string';
      }),
      { numRuns: 100 }
    );
  });

  it('should generate arbitrary arrays', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        return Array.isArray(arr);
      }),
      { numRuns: 100 }
    );
  });
});
