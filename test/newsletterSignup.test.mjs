import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNewsletterSignup } from '../src/shell.js';

test('renderNewsletterSignup renders a plain outbound link to the real Substack publication', () => {
  const markup = renderNewsletterSignup();
  const linkMatch = markup.match(/<a href="([^"]+)"[^>]*>Subscribe on Substack<\/a>/);
  assert.ok(linkMatch, 'expected a "Subscribe on Substack" link');
  assert.equal(linkMatch[1], 'https://builtittheycome.substack.com');
});

test('renderNewsletterSignup never embeds a third-party iframe or any lazy-load slot -- craft-audit fix, foreign branding removed entirely', () => {
  const markup = renderNewsletterSignup();
  assert.doesNotMatch(markup, /<iframe/);
  assert.doesNotMatch(markup, /data-newsletter-slot/);
  assert.doesNotMatch(markup, /data-newsletter-src/);
});

test('renderNewsletterSignup opens the link in a new tab safely, with no inline event handlers', () => {
  const markup = renderNewsletterSignup();
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.doesNotMatch(markup, /\son[a-z]+=/i);
});

test('renderNewsletterSignup only ever points at the https scheme', () => {
  const markup = renderNewsletterSignup();
  const linkMatch = markup.match(/<a href="([^"]+)"/);
  assert.ok(linkMatch);
  assert.match(linkMatch[1], /^https:\/\//);
});
