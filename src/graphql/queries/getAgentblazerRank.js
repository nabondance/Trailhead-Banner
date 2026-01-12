const GET_AGENTBLAZER_RANK = `
  fragment LearnerStatusLevel on LearnerStatusLevel {
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

fragment PublicProfile on PublicProfile {
  __typename
  trailheadStats {
    __typename
    learnerStatusLevels {
      ...LearnerStatusLevel
    }
  }
}

query GetAgentblazerStatus($slug: String, $hasSlug: Boolean!) {
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

export default GET_AGENTBLAZER_RANK;
