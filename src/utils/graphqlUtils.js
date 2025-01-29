import axios from 'axios';

class GraphQLUtils {
  static async performQueries(queries) {
    return await Promise.all(
      queries.map((query) =>
        axios.post(
          query.url,
          { query: query.query, variables: query.variables },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    );
  }
}

export default GraphQLUtils;
