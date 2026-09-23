# Trailhead GraphQL: Trail Data and Completion History

Research performed on 2026-09-21 against Trailhead's public production endpoints.

## Summary

Trailhead exposes two relevant GraphQL APIs:

| Endpoint                                    | Purpose                               | Anonymous access |
| ------------------------------------------- | ------------------------------------- | ---------------- |
| `https://profile.api.trailhead.com/graphql` | Public Trailblazer profile data       | Yes              |
| `https://mobile.api.trailhead.com/graphql`  | Learning catalog and learner progress | Partially        |

The public profile API exposes only the number of completed trails. The learning API has an actual
`completedTrails` query with trail names, URLs, progress, and completion dates, but it requires an authenticated
Trailhead user and only targets the current learner.

Consequently, Trailhead Banner cannot retrieve the exact completed trails of an arbitrary user from only their
public username.

## Request format

Both APIs accept an HTTP `POST` containing a standard GraphQL payload. No credentials are needed for public
operations.

```http
POST https://profile.api.trailhead.com/graphql
Content-Type: application/json

{
  "query": "...",
  "variables": {}
}
```

The profile frontend also sends an `Accept-Language` header. It must be included when querying earned awards;
without it, earned records are returned but their nested `award` metadata can resolve to `null`.

```http
Accept-Language: en-US
```

This is the same request format already used by `src/utils/graphqlUtils.js` and
`src/pages/api/graphql-query.js`.

## Public profile API

### Completed trail count

The public profile schema exposes `completedTrailCount` under `trailheadStats`:

```graphql
query GetTrailStats($slug: String!) {
  profile(slug: $slug) {
    ... on PublicProfile {
      id
      slug
      trailheadStats {
        completedTrailCount
      }
    }
  }
}
```

Variables:

```json
{
  "slug": "nabondance"
}
```

Example response:

```json
{
  "data": {
    "profile": {
      "id": "0051I000007TQuHQAW",
      "slug": "nabondance",
      "trailheadStats": {
        "completedTrailCount": 94
      }
    }
  }
}
```

The profile `id` is the user's 18-character Trailblazer ID. It is accepted by some operations on the learning
API, but not by `completedTrails`.

### Individual earned awards

The existing `earnedAwards` connection returns individual learning awards. Its `AwardTypeFilter` accepts only:

- `MODULE`
- `PROJECT`
- `SUPERBADGE`
- `EVENT`
- `STANDALONE`

There is no `TRAIL` award type. Public requests generally return `EarnedAwardBase`, which contains award metadata
but not `earnedAt`. `earnedAt` is present on the authenticated/self-only `EarnedAwardSelf` representation.

The following fields were tested and do not exist on `PublicProfile`:

```graphql
completedTrails
trails
```

The following field also does not exist on `TrailheadProfileStats`:

```graphql
completedTrails
```

The only suggested profile statistic is `completedTrailCount`.

## Learning API

Trailhead's learning frontend configures this endpoint as its experience/mobile GraphQL API:

```text
https://mobile.api.trailhead.com/graphql
```

Trailhead pages also use this same-origin proxy:

```text
https://trailhead.salesforce.com/services/mobile/graphql
```

### Anonymous trail catalog search

The `search` operation is available anonymously and returns public trail metadata:

```graphql
query SearchTrails($criteria: SearchInput!) {
  search(first: 5, criteria: $criteria) {
    edges {
      node {
        learning {
          id
          type
          name
          label
          url
          pointTotal
          minuteTotal
          progress {
            completedPercent
            completedDate
            earnedPoints
            state
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
```

Variables:

```json
{
  "criteria": {
    "text": "trailhead"
  }
}
```

Anonymous results include the trail metadata, but `progress` is `null`. Trail records currently use the
`LEARNINGPATH` type in search results, even though other parts of the schema and client use `TRAIL` as a filter or
learning kind.

Example result:

```json
{
  "learning": {
    "id": "026832da-4cc1-7fb8-e545-a5bbb3fd9e42",
    "type": "LEARNINGPATH",
    "name": "learn_salesforce_with_trailhead",
    "label": "Get Started with Trailhead",
    "url": "https://trailhead.salesforce.com/en/content/learn/trails/learn_salesforce_with_trailhead",
    "progress": null
  }
}
```

### Authenticated completed trails

The learning schema contains a root field named `completedTrails`:

```graphql
query CompletedTrails($first: Int, $after: String) {
  completedTrails(first: $first, after: $after) {
    totalCount
    edges {
      node {
        id
        type
        name
        label
        url
        pointTotal
        minuteTotal
        progress {
          completedPercent
          completedDate
          earnedPoints
          state
        }
      }
    }
    pageInfo {
      startCursor
      endCursor
      hasNextPage
    }
  }
}
```

An anonymous request returns:

```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "status": 401
    }
  ],
  "data": null
}
```

The operation accepts the pagination arguments `first` and `after`. It does not accept any of these user-targeting
arguments:

- `slug`
- `userId`
- `trailblazerId`

This indicates that it obtains the learner identity from the authentication token and returns completed trails for
the current authenticated learner only.

The Trailhead frontend sends authenticated learning requests with:

```http
Authorization: Bearer <Trailhead access token>
```

This is a per-user session token, not an application-wide public credential.

### Other earned-award operation

The learning schema also contains `getAllEarnedAwards`, which accepts an 18-character `TrailblazerId`:

```graphql
query GetAllEarnedAwards($first: Int, $after: String, $trailblazerId: TrailblazerId) {
  getAllEarnedAwards(first: $first, after: $after, trailblazerId: $trailblazerId) {
    totalCount
    edges {
      node {
        id
        earnedPoints
        type
        label
        learningName
        learningUrl
        awardedOn
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

Despite accepting another user's ID, this operation also returns `401 Unauthorized` without a Trailhead access
token. It is not available through the public profile GraphQL endpoint.

## Capability matrix

| Data                                    | Anonymous public user | Authenticated current user |
| --------------------------------------- | --------------------- | -------------------------- |
| Completed trail count                   | Yes                   | Yes                        |
| Public trail catalog and metadata       | Yes                   | Yes                        |
| Exact completed trail list              | No                    | Yes                        |
| Trail completion dates and progress     | No                    | Yes                        |
| Exact trails for an arbitrary username  | No                    | No exposed argument        |
| Individual public module/project awards | Yes                   | Yes                        |

## Implications for Trailhead Banner

The standard Trailhead Banner flow receives a public username and performs anonymous server-side queries. It can
continue displaying `completedTrailCount`, but it cannot reliably display trail names or completion dates.

Possible future options:

1. Keep the current anonymous model and expose only the completed trail count.
2. Add an explicit "Connect Trailhead" authentication flow, then use `completedTrails` for the signed-in learner.
3. Attempt to infer completed trails by cross-referencing earned modules with the current trail catalog. This is not
   recommended because modules can appear in multiple trails and trail contents can change over time.

## Deterministic current-requirements checker

The repository contains a server-side checker that performs the third option without AI:

```bash
pnpm trail:check <username> <trail-url-or-slug>
```

For example:

```bash
pnpm trail:check nabondance \
  https://trailhead.salesforce.com/content/learn/trails/agentforce-commerce-sell-everywhere-anytime
```

The script:

1. Downloads the server-rendered public trail page.
2. Extracts every module/project requirement from its `data-step-type`, `data-content-api-name`, and
   `data-content-uid` attributes.
3. Paginates the user's public `earnedAwards` for the required award types.
4. Matches by the content URL's API name, with the content ID as a secondary exact match. The URL/API name is
   necessary because the trail page and profile APIs can assign different UUIDs to the same module.
5. Returns JSON with `current-requirements-satisfied`, `current-requirements-missing`, or `indeterminate`.

This result answers whether the public awards satisfy the trail's **current** definition. It intentionally leaves
`authoritativeHistoricalCompletion` as `null`: a trail completed years ago can later acquire new requirements, and
the anonymous APIs do not expose the user's historical completed-trail list.

The same command accepts a public Trail Mix URL:

```bash
pnpm trail:check <username> \
  https://trailhead.salesforce.com/users/<creator>/trailmixes/<slug>
```

Trail Mix pages embed their items as JSON in server-rendered `ModuleBrick` elements. Modules, projects, and
superbadges are compared with public earned awards. Nested trails are expanded into their current requirements.
Custom tasks and external links cannot be verified anonymously because their manual completion state belongs to the
signed-in user; a Trail Mix containing any such item returns `indeterminate`. Private or unpublished Trail Mixes
return HTTP 404 to an anonymous server request and cannot be checked without authentication.

The GraphQL APIs are undocumented implementation details used by Salesforce's frontend. Their fields, authorization
rules, and endpoints may change without notice.
