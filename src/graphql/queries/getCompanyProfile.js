/**
 * Combined profile query for the company banner.
 * Fetches rank, certifications, superbadges, and agentblazer levels in ONE
 * request. Trailhead's profile API rate-limits by request count (not query
 * complexity), so merging the 4 per-user queries into a single document cuts
 * the rate-limit cost of a team fetch by 75%.
 */
// Field selection is intentionally minimal: only what aggregateCompanyData,
// the banner components, and the CSV export actually read. Slimmer responses
// mean smaller Redis entries and a smaller resolvedData payload the browser
// re-uploads for the render call.
const GET_COMPANY_PROFILE = `
  query GetCompanyProfile($slug: String, $hasSlug: Boolean!, $count: Int = 100, $filter: AwardTypeFilter = SUPERBADGE) {
    profile(slug: $slug) @include(if: $hasSlug) {
      __typename
      ... on PublicProfile {
        trailheadStats {
          __typename
          earnedPointsSum
          earnedBadgesCount
          completedTrailCount
          rank {
            __typename
            title
          }
          learnerStatusLevels {
            __typename
            statusName
            title
            level
            imageUrl
            completedAt
            progress
            edition
            medalImageUrl
            active
          }
        }
        credential {
          certifications {
            dateCompleted
            dateExpired
            maintenanceDueDate
            logoUrl
            product
            status {
              __typename
              title
              expired
            }
            title
          }
        }
        earnedAwards(first: $count, awardType: $filter) {
          edges {
            node {
              ... on EarnedAwardBase {
                __typename
                id
                award {
                  __typename
                  id
                  title
                  type
                  icon
                }
              }
            }
          }
        }
      }
      ... on PrivateProfile {
        __typename
      }
    }
  }
`;

export default GET_COMPANY_PROFILE;
