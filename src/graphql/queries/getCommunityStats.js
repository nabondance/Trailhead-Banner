const GET_COMMUNITY_STATS = `
  query GetQuestionsAnswersStatsAndConnections($userSlug: ID!) {
    profileData(userSlug: $userSlug) {
      communityUserId
      questionAndAnswersStats {
        answersCount
        bestAnswersCount
        communityUserRank
        questionsCount
      }
      communityConnections {
        followers {
          totalCount
        }
        following {
          totalCount
        }
        groups {
          totalCount
        }
      }
    }
  }
`;

export default GET_COMMUNITY_STATS;
