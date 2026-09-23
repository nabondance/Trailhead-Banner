#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TRAILHEAD_ORIGIN = 'https://trailhead.salesforce.com';
const PROFILE_GRAPHQL_URL = 'https://profile.api.trailhead.com/graphql';
const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 100;

const STEP_TYPE_TO_AWARD_TYPE = {
  'th-module': 'MODULE',
  'th-project': 'PROJECT',
  'th-superbadge': 'SUPERBADGE',
};

const EARNED_AWARDS_QUERY = `
  query PublicEarnedAwards(
    $slug: String!
    $first: Int!
    $after: String
    $filter: AwardTypeFilter
  ) {
    profile(slug: $slug) {
      __typename
      ... on PublicProfile {
        slug
        trailheadStats {
          completedTrailCount
          earnedBadgesCount
        }
        earnedAwards(first: $first, after: $after, awardType: $filter) {
          edges {
            node {
              __typename
              ... on EarnedAwardBase {
                id
                award {
                  id
                  title
                  type
                  content {
                    webUrl
                  }
                }
              }
              ... on EarnedAwardSelf {
                id
                award {
                  id
                  title
                  type
                  content {
                    webUrl
                  }
                }
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

function decodeHtml(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return namedEntities[code.toLowerCase()] ?? entity;
    const radix = code[1].toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? code.slice(2) : code.slice(1);
    return String.fromCodePoint(Number.parseInt(digits, radix));
  });
}

function plainText(html) {
  return decodeHtml(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1]] = decodeHtml(match[2] ?? match[3] ?? '');
  }

  return attributes;
}

export function parseTrailRequirements(html) {
  const requirements = [];
  const seen = new Set();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const attributes = parseAttributes(match[1]);
    const stepType = attributes['data-step-type'];
    if (!stepType) continue;

    const awardType = STEP_TYPE_TO_AWARD_TYPE[stepType] ?? null;
    const contentId = attributes['data-content-uid'] ?? null;
    const apiName = attributes['data-content-api-name'] ?? null;
    const key = `${stepType}:${contentId ?? apiName ?? attributes.href ?? match.index}`;
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      stepType,
      awardType,
      contentId,
      apiName,
      title: plainText(match[2]),
      url: attributes.href ? new URL(attributes.href, TRAILHEAD_ORIGIN).href : null,
      supported: Boolean(awardType && (contentId || apiName)),
    });
  }

  return requirements;
}

export function normalizeContentSource(input) {
  if (/^[a-z0-9][a-z0-9_-]*$/i.test(input)) {
    return {
      type: 'trail',
      slug: input,
      url: `${TRAILHEAD_ORIGIN}/content/learn/trails/${encodeURIComponent(input)}`,
    };
  }

  const url = new URL(input);
  if (url.hostname !== 'trailhead.salesforce.com') {
    throw new Error('The URL must use trailhead.salesforce.com.');
  }

  const trailMatch = url.pathname.match(/\/content\/learn\/trails\/([a-z0-9_-]+)/i);
  if (trailMatch) {
    return {
      type: 'trail',
      slug: trailMatch[1],
      url: `${TRAILHEAD_ORIGIN}/content/learn/trails/${encodeURIComponent(trailMatch[1])}`,
    };
  }

  const trailmixMatch = url.pathname.match(/\/users\/([a-z0-9_.-]+)\/trailmixes\/([a-z0-9_-]+)/i);
  if (trailmixMatch) {
    const [, creator, slug] = trailmixMatch;
    return {
      type: 'trailmix',
      creator,
      slug,
      url: `${TRAILHEAD_ORIGIN}/users/${encodeURIComponent(creator)}/trailmixes/${encodeURIComponent(slug)}`,
    };
  }

  throw new Error('The URL is not a Trailhead trail or Trail Mix URL.');
}

function apiNameFromWebUrl(webUrl) {
  if (!webUrl) return null;

  try {
    const parts = new URL(webUrl).pathname.split('/').filter(Boolean);
    const learnIndex = parts.indexOf('learn');
    return learnIndex >= 0 ? (parts[learnIndex + 2] ?? null) : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'accept-language': 'en-US',
      ...options.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function fetchTrailRequirements(trailInput) {
  const source = normalizeContentSource(trailInput);
  if (source.type !== 'trail') throw new Error('Expected a Trailhead trail URL or slug.');

  const response = await fetchWithTimeout(source.url);

  if (!response.ok) throw new Error(`Trail page returned HTTP ${response.status}.`);

  const html = await response.text();
  const requirements = parseTrailRequirements(html);
  if (requirements.length === 0) {
    throw new Error('No trail requirements were found in the Trailhead page.');
  }

  const titleMatch = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    type: source.type,
    slug: source.slug,
    url: source.url,
    title: titleMatch ? plainText(titleMatch[1]) : source.slug,
    requirements,
  };
}

export function parseTrailmixRequirements(html) {
  const requirements = [];
  const divPattern = /<div\b([^>]*)>/gi;
  let match;

  while ((match = divPattern.exec(html)) !== null) {
    const attributes = parseAttributes(match[1]);
    if (attributes['data-react-class'] !== 'ModuleBrick') continue;

    let props;
    try {
      props = JSON.parse(attributes['data-react-props']);
    } catch {
      throw new Error('A Trail Mix item contained invalid embedded JSON.');
    }

    const content = props.content ?? {};
    const awardType =
      {
        module: 'MODULE',
        project: 'PROJECT',
        superbadge: 'SUPERBADGE',
      }[content.type] ?? null;

    requirements.push({
      trailmixItemIndex: requirements.length,
      stepType: `trailmix-${content.type ?? 'unknown'}`,
      awardType,
      contentId: content.contentUid ?? props.completionData?.customStepId ?? null,
      apiName: content.apiName ?? null,
      title: content.title ?? 'Untitled Trail Mix item',
      url: content.path ? new URL(content.path, TRAILHEAD_ORIGIN).href : null,
      supported: Boolean(awardType && content.apiName),
      contentType: content.type ?? 'unknown',
      manualCompletion: content.manualCompletion ?? false,
    });
  }

  return requirements;
}

async function fetchTrailmixRequirements(trailmixInput) {
  const source = normalizeContentSource(trailmixInput);
  if (source.type !== 'trailmix') throw new Error('Expected a Trailhead Trail Mix URL.');

  const response = await fetchWithTimeout(source.url);
  if (!response.ok) {
    const detail = response.status === 404 ? ' It may be private, unpublished, deleted, or the URL may be stale.' : '';
    throw new Error(`Trail Mix page returned HTTP ${response.status}.${detail}`);
  }

  const html = await response.text();
  const items = parseTrailmixRequirements(html);
  if (items.length === 0) throw new Error('No Trail Mix items were found in the public page.');

  const requirements = [];
  for (const item of items) {
    if (item.contentType !== 'trail' || !item.apiName) {
      requirements.push(item);
      continue;
    }

    try {
      const nestedTrail = await fetchTrailRequirements(item.apiName);
      requirements.push(
        ...nestedTrail.requirements.map((requirement) => ({
          ...requirement,
          trailmixItemIndex: item.trailmixItemIndex,
          includedBy: {
            type: 'trail',
            slug: nestedTrail.slug,
            title: nestedTrail.title,
            url: nestedTrail.url,
          },
        }))
      );
    } catch (error) {
      requirements.push({ ...item, expansionError: error.message });
    }
  }

  const titleMatch = html.match(
    /<meta\b[^>]*property=(?:"og:title"|'og:title')[^>]*content=(?:"([^"]*)"|'([^']*)')[^>]*>/i
  );

  return {
    ...source,
    title: titleMatch
      ? decodeHtml(titleMatch[1] ?? titleMatch[2]).replace(/ Trailmix \| Salesforce Trailhead$/, '')
      : source.slug,
    requirements,
    itemCount: items.length,
    items,
  };
}

async function fetchContentRequirements(input) {
  const source = normalizeContentSource(input);
  return source.type === 'trail' ? fetchTrailRequirements(source.url) : fetchTrailmixRequirements(source.url);
}

async function fetchAwardPage(username, awardType, after) {
  const response = await fetchWithTimeout(PROFILE_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: EARNED_AWARDS_QUERY,
      variables: {
        slug: username,
        first: PAGE_SIZE,
        after,
        filter: awardType,
      },
    }),
  });

  if (!response.ok) throw new Error(`Profile GraphQL returned HTTP ${response.status}.`);

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(`Profile GraphQL error: ${result.errors.map(({ message }) => message).join('; ')}`);
  }

  const profile = result.data?.profile;
  if (!profile) throw new Error(`Trailhead profile "${username}" was not found.`);
  if (profile.__typename !== 'PublicProfile') {
    throw new Error(`Trailhead profile "${username}" is not public.`);
  }

  return profile;
}

export async function fetchPublicAwards(username, awardTypes) {
  const awards = [];
  const stats = {};
  let unresolvedAwardCount = 0;
  let requestCount = 0;

  for (const awardType of awardTypes) {
    let after = null;

    do {
      const profile = await fetchAwardPage(username, awardType, after);
      Object.assign(stats, profile.trailheadStats);
      requestCount += 1;

      for (const { node } of profile.earnedAwards.edges) {
        if (!node?.award) {
          unresolvedAwardCount += 1;
          continue;
        }

        awards.push({
          earnedRecordId: node.id,
          id: node.award.id,
          title: node.award.title,
          type: node.award.type,
          webUrl: node.award.content?.webUrl ?? null,
          apiName: apiNameFromWebUrl(node.award.content?.webUrl),
        });
      }

      const { pageInfo } = profile.earnedAwards;
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (after);
  }

  return { awards, stats, unresolvedAwardCount, requestCount };
}

export function compareRequirements(requirements, publicAwards) {
  const byId = new Map(publicAwards.awards.map((award) => [award.id, award]));
  const byTypeAndApiName = new Map(
    publicAwards.awards.filter(({ apiName }) => apiName).map((award) => [`${award.type}:${award.apiName}`, award])
  );

  return requirements.map((requirement) => {
    if (!requirement.supported) return { ...requirement, earned: null, matchedBy: null };

    const idMatch = requirement.contentId ? byId.get(requirement.contentId) : null;
    const apiNameMatch = requirement.apiName
      ? byTypeAndApiName.get(`${requirement.awardType}:${requirement.apiName}`)
      : null;
    const award = idMatch ?? apiNameMatch ?? null;

    return {
      ...requirement,
      earned: Boolean(award),
      matchedBy: idMatch ? 'content-id' : apiNameMatch ? 'api-name' : null,
      earnedAward: award,
    };
  });
}

export async function checkLearningRequirements(username, contentInput) {
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(username)) {
    throw new Error('Invalid Trailblazer username.');
  }

  const content = await fetchContentRequirements(contentInput);
  const awardTypes = [...new Set(content.requirements.map(({ awardType }) => awardType).filter(Boolean))];
  const publicAwards = await fetchPublicAwards(username, awardTypes);
  const requirements = compareRequirements(content.requirements, publicAwards);
  const unsupportedCount = requirements.filter(({ supported }) => !supported).length;
  const missingCount = requirements.filter(({ earned }) => earned === false).length;
  const earnedCount = requirements.filter(({ earned }) => earned === true).length;
  const trailmixItems =
    content.type === 'trailmix'
      ? content.items.map((item) => {
          const itemRequirements = requirements.filter(
            ({ trailmixItemIndex }) => trailmixItemIndex === item.trailmixItemIndex
          );
          const itemUnsupportedCount = itemRequirements.filter(({ supported }) => !supported).length;
          const itemMissingCount = itemRequirements.filter(({ earned }) => earned === false).length;
          const itemEarnedCount = itemRequirements.filter(({ earned }) => earned === true).length;
          const itemVerdict =
            itemUnsupportedCount > 0
              ? 'indeterminate'
              : itemMissingCount > 0
                ? 'current-requirements-missing'
                : 'current-requirements-satisfied';

          return {
            index: item.trailmixItemIndex,
            type: item.contentType,
            apiName: item.apiName,
            title: item.title,
            url: item.url,
            verdict: itemVerdict,
            requirementCount: itemRequirements.length,
            earnedCount: itemEarnedCount,
            missingCount: itemMissingCount,
            unsupportedCount: itemUnsupportedCount,
          };
        })
      : undefined;

  let verdict = 'current-requirements-satisfied';
  if (unsupportedCount > 0) {
    verdict = 'indeterminate';
  } else if (missingCount > 0) {
    verdict = 'current-requirements-missing';
  }

  return {
    username,
    content: {
      type: content.type,
      creator: content.creator,
      slug: content.slug,
      title: content.title,
      url: content.url,
      ...(content.type === 'trailmix' ? { itemCount: content.itemCount } : {}),
    },
    verdict,
    authoritativeHistoricalCompletion: null,
    explanation:
      verdict === 'current-requirements-satisfied'
        ? 'Every requirement in the current public definition appears in the public earned awards.'
        : verdict === 'current-requirements-missing'
          ? 'At least one requirement in the current public definition is absent from the public earned awards.'
          : 'The public data cannot verify every item. Trail Mix custom tasks and external links require authenticated/manual completion data.',
    caveat:
      'This proves whether the current publicly verifiable requirements are satisfied. Anonymous public APIs do not expose authoritative historical completion, and content definitions can change. Earned records with null award metadata refer to content that the current public catalog cannot resolve, so they cannot match a current live requirement.',
    summary: {
      requirementCount: requirements.length,
      earnedCount,
      missingCount,
      unsupportedCount,
      publicEarnedBadgesCount: publicAwards.stats.earnedBadgesCount,
      publicCompletedTrailCount: publicAwards.stats.completedTrailCount,
      unresolvedAwardCount: publicAwards.unresolvedAwardCount,
      graphqlRequestCount: publicAwards.requestCount,
      ...(trailmixItems
        ? {
            trailmixItemSatisfiedCount: trailmixItems.filter(
              ({ verdict: itemVerdict }) => itemVerdict === 'current-requirements-satisfied'
            ).length,
            trailmixItemMissingCount: trailmixItems.filter(
              ({ verdict: itemVerdict }) => itemVerdict === 'current-requirements-missing'
            ).length,
            trailmixItemIndeterminateCount: trailmixItems.filter(
              ({ verdict: itemVerdict }) => itemVerdict === 'indeterminate'
            ).length,
          }
        : {}),
    },
    ...(trailmixItems ? { trailmixItems } : {}),
    requirements,
  };
}

export const checkTrailRequirements = checkLearningRequirements;

function printUsage() {
  console.error('Usage: node scripts/check-trail-completion.mjs <username> <trail-url-or-slug-or-trailmix-url>');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const [, , username, trailInput] = process.argv;
  if (!username || !trailInput) {
    printUsage();
    process.exitCode = 1;
  } else {
    try {
      const result = await checkLearningRequirements(username, trailInput);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }, null, 2));
      process.exitCode = 1;
    }
  }
}
