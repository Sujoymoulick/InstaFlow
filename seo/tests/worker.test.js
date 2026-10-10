/**
 * Instaflow SEO Suite - Tier 2 Proxy Worker & SSRF Guard Unit Tests
 * Run via: node --test seo/tests/worker.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateUrlSafety } from '../worker/ssrf-guard.js';

describe('Tier 2 SSRF Security Guard', () => {
  it('permits public, safe HTTP and HTTPS URLs on standard ports', () => {
    assert.strictEqual(validateUrlSafety('https://example.com').safe, true);
    assert.strictEqual(validateUrlSafety('http://instaflow.io/blog/post-1').safe, true);
    assert.strictEqual(validateUrlSafety('https://news.ycombinator.com:443').safe, true);
  });

  it('blocks localhost, loopback, and local domain variants', () => {
    assert.strictEqual(validateUrlSafety('http://localhost').safe, false);
    assert.strictEqual(validateUrlSafety('http://127.0.0.1:8080').safe, false);
    assert.strictEqual(validateUrlSafety('http://127.0.0.2').safe, false);
    assert.strictEqual(validateUrlSafety('http://test.local').safe, false);
    assert.strictEqual(validateUrlSafety('http://api.internal').safe, false);
  });

  it('blocks private IP ranges (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)', () => {
    assert.strictEqual(validateUrlSafety('http://10.0.0.1').safe, false);
    assert.strictEqual(validateUrlSafety('http://192.168.1.1').safe, false);
    assert.strictEqual(validateUrlSafety('http://172.16.0.5').safe, false);
  });

  it('blocks cloud metadata endpoints (169.254.169.254 / GCP metadata)', () => {
    assert.strictEqual(validateUrlSafety('http://169.254.169.254/latest/meta-data/').safe, false);
    assert.strictEqual(validateUrlSafety('http://metadata.google.internal/computeMetadata/v1/').safe, false);
  });

  it('blocks disallowed protocols (file://, ftp://, gopher://, javascript:)', () => {
    assert.strictEqual(validateUrlSafety('file:///etc/passwd').safe, false);
    assert.strictEqual(validateUrlSafety('ftp://files.example.com').safe, false);
    assert.strictEqual(validateUrlSafety('javascript:alert(1)').safe, false);
  });

  it('blocks non-standard internal ports', () => {
    assert.strictEqual(validateUrlSafety('http://example.com:22').safe, false);
    assert.strictEqual(validateUrlSafety('http://example.com:3306').safe, false);
    assert.strictEqual(validateUrlSafety('http://example.com:5432').safe, false);
    assert.strictEqual(validateUrlSafety('http://example.com:6379').safe, false);
  });
});
