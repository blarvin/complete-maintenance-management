/**
 * `Edges(external)` value handling for `part-supplier-link` — the pure half the
 * renderer leans on. The renderer itself is a `.tsx` (Cypress territory); this is
 * the part that decides whether a typed value ever becomes a live `href`.
 */

import { describe, it, expect } from 'vitest';
import { safeHttpUrl, displayUrl } from '../utils/url';

describe('safeHttpUrl', () => {
  it('accepts http and https', () => {
    expect(safeHttpUrl('https://supplier.example/part/9')).toBe('https://supplier.example/part/9');
    expect(safeHttpUrl('http://supplier.example')).toBe('http://supplier.example/');
  });

  it('assumes https for a bare host, which is how a supplier URL gets typed', () => {
    expect(safeHttpUrl('supplier.example/part/9')).toBe('https://supplier.example/part/9');
  });

  it('refuses every scheme that could execute or smuggle content', () => {
    // The reason this function exists: the value is user-typed and lands in an href.
    for (const hostile of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)  ',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(safeHttpUrl(hostile)).toBeNull();
    }
  });

  it('refuses empty and unparseable input', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl('   ')).toBeNull();
    expect(safeHttpUrl('http://')).toBeNull();
  });
});

describe('displayUrl', () => {
  it('drops the scheme and a bare trailing slash', () => {
    expect(displayUrl('https://supplier.example/')).toBe('supplier.example');
    expect(displayUrl('https://supplier.example/part/9')).toBe('supplier.example/part/9');
    expect(displayUrl('https://supplier.example/search?q=bearing')).toBe('supplier.example/search?q=bearing');
  });

  it('passes a value it would not link through unchanged, rather than hiding it', () => {
    expect(displayUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});
