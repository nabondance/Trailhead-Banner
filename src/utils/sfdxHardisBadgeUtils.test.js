import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSfdxHardisBadgeUrl,
  fetchSfdxHardisBadges,
  getHighestSfdxHardisBadge,
  normalizeSfdxHardisBadgeRecord,
} from './sfdxHardisBadgeUtils.js';

const record = {
  recipient: 'nvuillam',
  trailblazer: 'nvuillamy',
  name: 'Nicolas Vuillamy',
  badges: [
    {
      type: 'Achievement',
      level: 1,
      name: 'sfdx-hardis Contributor Basics',
      description: 'Delivers a User Story.',
      issuer: {
        name: 'Cloudity',
        course: 'https://hardisgroupcom.github.io/sfdx-hardis-training',
      },
      issuedOn: '2026-09-20',
      checksPassed: 7,
      checksTotal: 7,
      image: 'https://untrusted.example/badge.svg',
    },
    {
      type: 'Achievement',
      level: 3,
      name: 'sfdx-hardis Release Manager',
      description: 'Owns the pipeline.',
      issuer: {
        name: 'Cloudity',
        course: 'https://hardisgroupcom.github.io/sfdx-hardis-training',
      },
      issuedOn: '2026-09-22',
      checksPassed: 23,
      checksTotal: 23,
      image: 'https://untrusted.example/badge.svg',
    },
  ],
};

test('builds a badge endpoint only for a plain Trailblazer username', () => {
  assert.equal(
    buildSfdxHardisBadgeUrl('Nvuillamy'),
    'https://hardisgroupcom.github.io/sfdx-hardis-training/badges/nvuillamy.json'
  );
  assert.equal(buildSfdxHardisBadgeUrl('../secret'), null);
});

test('normalizes verified badges and derives trusted image URLs', () => {
  const normalized = normalizeSfdxHardisBadgeRecord(record, 'nvuillamy');

  assert.equal(normalized.badges.length, 2);
  assert.equal(
    normalized.badges[1].image,
    'https://hardisgroupcom.github.io/sfdx-hardis-training/badges/img/nvuillamy-level-3.svg'
  );
  assert.equal(getHighestSfdxHardisBadge(normalized).level, 3);
});

test('rejects records filed under another Trailblazer username', () => {
  assert.equal(normalizeSfdxHardisBadgeRecord(record, 'someone-else'), null);
});

test('returns null for a missing badge without throwing', async () => {
  const cacheWrites = [];
  const result = await fetchSfdxHardisBadges('missing-user', {
    httpClient: { get: async () => ({ status: 404 }) },
    cache: {
      getCachedQuery: async () => null,
      setCachedQuery: async (...args) => cacheWrites.push(args),
    },
  });

  assert.equal(result, null);
  assert.equal(cacheWrites[0][1].status, 'missing');
});

test('uses a valid cached badge record without making an HTTP request', async () => {
  const normalized = normalizeSfdxHardisBadgeRecord(record, 'nvuillamy');
  let requested = false;
  const result = await fetchSfdxHardisBadges('nvuillamy', {
    httpClient: {
      get: async () => {
        requested = true;
        return { status: 500 };
      },
    },
    cache: {
      getCachedQuery: async () => ({ status: 'found', data: normalized }),
      setCachedQuery: async () => {},
    },
  });

  assert.equal(result.badges.length, 2);
  assert.equal(requested, false);
});
