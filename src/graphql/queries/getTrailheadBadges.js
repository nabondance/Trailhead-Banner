// src/graphql/queries/getTrailheadBadges.js

const GET_TRAILHEAD_BADGES = `
  fragment EarnedAward on EarnedAwardBase {
    __typename
    id
    award {
      __typename
      id
      title
      type
      icon
      content {
        __typename
        webUrl
        description
      }
    }
  }

  fragment EarnedAwardSelf on EarnedAwardSelf {
    __typename
    id
    award {
      __typename
      id
      title
      type
      icon
      content {
        __typename
        webUrl
        description
      }
    }
    earnedAt
    earnedPointsSum
  }

  fragment StatsBadgeCount on TrailheadProfileStats {
    __typename
    earnedBadgesCount
    superbadgeCount
  }

  fragment ProfileBadges on PublicProfile {
    __typename
    trailheadStats {
      ... on TrailheadProfileStats {
        ...StatsBadgeCount
      }
    }
    earnedAwards(first: $count, after: $after, awardType: $filter) {
      edges {
        node {
          ... on EarnedAwardBase {
            ...EarnedAward
          }
          ... on EarnedAwardSelf {
            ...EarnedAwardSelf
          }
        }
      }
      pageInfo {
        ...PageInfoBidirectional
      }
    }
  }

  fragment PageInfoBidirectional on PageInfo {
    __typename
    endCursor
    hasNextPage
    startCursor
    hasPreviousPage
  }

  query GetTrailheadBadges($slug: String, $hasSlug: Boolean!, $count: Int = 8, $after: String = null, $filter: AwardTypeFilter = null) {
    profile(slug: $slug) @include(if: $hasSlug) {
      __typename
      ... on PublicProfile {
        ...ProfileBadges
      }
    }
  }
`;

export default GET_TRAILHEAD_BADGES;