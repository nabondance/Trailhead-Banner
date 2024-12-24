const GET_USER_CERTIFICATIONS = `
  query GetUserCertifications($slug: String, $hasSlug: Boolean!) {
    profile(slug: $slug) @include(if: $hasSlug) {
      __typename
      id
      ... on PublicProfile {
        credential {
          messages {
            __typename
            body
            header
            location
            image
            cta {
              __typename
              label
              url
            }
            orientation
          }
          messagesOnly
          brands {
            __typename
            id
            name
            logo
          }
          certifications {
            cta {
              __typename
              label
              url
            }
            dateCompleted
            dateExpired
            downloadLogoUrl
            logoUrl
            infoUrl
            maintenanceDueDate
            product
            publicDescription
            status {
              __typename
              title
              expired
              date
              color
              order
            }
            title
          }
        }
      }
    }
  }
`;

export default GET_USER_CERTIFICATIONS;
