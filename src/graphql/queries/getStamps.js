const GET_STAMPS = `
  query EarnedStamps($slug: String!, $first: Int, $after: String) {
  earnedStamps(slug: $slug, first: $first, after: $after) {
    ...EarnedStamps
    __typename
  }
}

fragment EarnedStamps on StampEarnedConnection {
  __typename
  count
  totalCount
  edges {
    __typename
    cursor
    node {
      ...EarnedStamp
      __typename
    }
  }
  pageInfo {
    endCursor
    hasNextPage
    __typename
  }
}

fragment EarnedStamp on StampEarned {
  __typename
  rewardId
  kind
  apiName
  name
  description
  eventDate
  eventLocation
  iconUrl
  linkUrl
}
`;

export default GET_STAMPS;
