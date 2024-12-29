
const GET_MVP_STATUS = `
  query GetTbcMvpContext($userSlug: ID!, $queryMvp: Boolean!) {
    profileData(userSlug: $userSlug) @include(if: $queryMvp) {
      isMvp
    }
  }
`;

export default GET_MVP_STATUS;