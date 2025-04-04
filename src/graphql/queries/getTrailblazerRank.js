const GET_TRAILBLAZER_RANK = `
  fragment TrailheadRank on TrailheadRank {
    __typename
    title
    requiredPointsSum
    requiredBadgesCount
    imageUrl
  }

  fragment LearnerStatusLevel on LearnerStatusLevel {
    __typename
    statusName
    title
    level
    imageUrl
    completedAt
    progress
  }

  fragment PublicProfile on PublicProfile {
    __typename
    trailheadStats {
      __typename
      earnedPointsSum
      earnedBadgesCount
      completedTrailCount
      rank {
        ...TrailheadRank
      }
      nextRank {
        ...TrailheadRank
      }
      learnerStatusLevels {
        ...LearnerStatusLevel
      }
    }
  }


  query GetTrailblazerRank($slug: String, $hasSlug: Boolean!) {
    profile(slug: $slug) @include(if: $hasSlug) {
      ... on PublicProfile {
        ...PublicProfile
      }
      ... on PrivateProfile {
        __typename
      }
    }
  }
`;

export default GET_TRAILBLAZER_RANK;
