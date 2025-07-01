import { describe, expect, it } from 'vitest';
import { getBaseUrl } from './base-url';

describe('getBaseUrl', () => {
  it('should return the base URL when provided', () => {
    expect(getBaseUrl('https://example.com').href).toBe('https://example.com/');
  });

  it('should return the Vercel URL when no base URL is provided', () => {
    expect(
      getBaseUrl(undefined, {
        VERCEL_URL: 'my-preview-branch.vercel.app',
      }).href
    ).toBe('https://my-preview-branch.vercel.app/');
  });

  it('should add the protection bypass token to the Vercel URL when no base URL is provided', () => {
    expect(
      getBaseUrl(undefined, {
        VERCEL_URL: 'my-preview-branch.vercel.app',
        VERCEL_AUTOMATION_BYPASS_SECRET: 'my-secret',
      }).href
    ).toBe(
      'https://my-preview-branch.vercel.app/?x-vercel-protection-bypass=my-secret'
    );
  });
});
