import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSource = await readFile(new URL('./usernameValidation.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`;
const { extractUsernameFromUrl } = await import(moduleUrl);

test('keeps a plain username', () => {
  assert.equal(extractUsernameFromUrl('nabondance'), 'nabondance');
});

test('extracts a username from the Salesforce profile URL', () => {
  assert.equal(
    extractUsernameFromUrl('https://www.salesforce.com/trailblazer/nabondance?lang=en#profile'),
    'nabondance'
  );
});

test('extracts a username from the Trailblazer.me profile URL', () => {
  assert.equal(extractUsernameFromUrl('https://trailblazer.me/id/nabondance'), 'nabondance');
});

test('extracts a profile URL from English share text', () => {
  const sharedText = `Check out my Trailblazer.me profile on @trailhead #Trailhead
 https://trailblazer.me/id/nabondance`;

  assert.equal(extractUsernameFromUrl(sharedText), 'nabondance');
});

test('extracts a profile URL from localized share text', () => {
  const sharedText = `Consultez mon profil Trailblazer.me sur @trailhead #Trailhead
 https://trailblazer.me/id/nabondance`;

  assert.equal(extractUsernameFromUrl(sharedText), 'nabondance');
});

test('ignores sentence punctuation after a shared URL', () => {
  assert.equal(extractUsernameFromUrl('My profile is https://trailblazer.me/id/nabondance, follow me!'), 'nabondance');
});

test('does not treat lookalike domains as Trailblazer profiles', () => {
  assert.equal(
    extractUsernameFromUrl('See https://trailblazer.me.example.com/id/nabondance'),
    'https://trailblazer.me.example.com/id/nabondance'
  );
});
