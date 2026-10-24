import { describe, it, expect } from 'vitest';
import { parseStatusCodeSpec, isValidStatusCodeSpec, isStatusAccepted } from '../http-status';

describe('parseStatusCodeSpec', () => {
  it('returns null for empty or missing specs', () => {
    expect(parseStatusCodeSpec(undefined)).toBeNull();
    expect(parseStatusCodeSpec(null)).toBeNull();
    expect(parseStatusCodeSpec('')).toBeNull();
    expect(parseStatusCodeSpec('   ')).toBeNull();
  });

  it('parses single codes and ranges', () => {
    expect(parseStatusCodeSpec('404')).toEqual([[404, 404]]);
    expect(parseStatusCodeSpec('200-299')).toEqual([[200, 299]]);
    expect(parseStatusCodeSpec('200-299,404')).toEqual([[200, 299], [404, 404]]);
  });

  it('tolerates whitespace and trailing commas', () => {
    expect(parseStatusCodeSpec(' 200 - 299 , 404 , ')).toEqual([[200, 299], [404, 404]]);
  });

  it('repairs a reversed range instead of discarding it', () => {
    expect(parseStatusCodeSpec('299-200')).toEqual([[200, 299]]);
  });

  it('rejects malformed specs', () => {
    expect(parseStatusCodeSpec('abc')).toBeNull();
    expect(parseStatusCodeSpec('20')).toBeNull();      // 3 haneli olmali
    expect(parseStatusCodeSpec('1000')).toBeNull();
    expect(parseStatusCodeSpec('099')).toBeNull();     // 100'un altinda
    expect(parseStatusCodeSpec('600')).toBeNull();     // 599'un ustunde
    expect(parseStatusCodeSpec('200--299')).toBeNull();
    expect(parseStatusCodeSpec('200-')).toBeNull();
  });
});

describe('isStatusAccepted', () => {
  // Spec yoksa eski davranis aynen korunmali.
  it('falls back to "anything below 400" with no spec', () => {
    expect(isStatusAccepted(200)).toBe(true);
    expect(isStatusAccepted(301)).toBe(true);
    expect(isStatusAccepted(399)).toBe(true);
    expect(isStatusAccepted(404)).toBe(false);
    expect(isStatusAccepted(500)).toBe(false);
  });

  it('falls back to the default when the spec is malformed', () => {
    expect(isStatusAccepted(404, 'nonsense')).toBe(false);
    expect(isStatusAccepted(200, 'nonsense')).toBe(true);
  });

  // Asil kullanim: saglik ucu olmayan, kokunde 404 donen servisler.
  it('accepts 404 when the spec asks for it', () => {
    expect(isStatusAccepted(404, '200-299,404')).toBe(true);
    expect(isStatusAccepted(200, '200-299,404')).toBe(true);
    expect(isStatusAccepted(500, '200-299,404')).toBe(false);
    expect(isStatusAccepted(403, '200-299,404')).toBe(false);
  });

  it('a spec narrows as well as widens', () => {
    // Yalnizca 200 kabul: 301 artik basarisiz sayilir.
    expect(isStatusAccepted(200, '200')).toBe(true);
    expect(isStatusAccepted(301, '200')).toBe(false);
  });

  it('handles boundaries inclusively', () => {
    expect(isStatusAccepted(200, '200-299')).toBe(true);
    expect(isStatusAccepted(299, '200-299')).toBe(true);
    expect(isStatusAccepted(300, '200-299')).toBe(false);
  });
});

describe('isValidStatusCodeSpec', () => {
  it('treats empty as valid (means "use the default")', () => {
    expect(isValidStatusCodeSpec('')).toBe(true);
    expect(isValidStatusCodeSpec(null)).toBe(true);
    expect(isValidStatusCodeSpec(undefined)).toBe(true);
  });

  it('accepts well-formed specs and rejects the rest', () => {
    expect(isValidStatusCodeSpec('200-299,404')).toBe(true);
    expect(isValidStatusCodeSpec('418')).toBe(true);
    expect(isValidStatusCodeSpec('200;404')).toBe(false);
    expect(isValidStatusCodeSpec('ok')).toBe(false);
  });
});
