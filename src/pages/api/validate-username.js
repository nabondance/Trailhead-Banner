import axios from 'axios';
import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import { validateUsernameWithGraphQL } from '../../utils/usernameValidation';

export default async function handler(req, res) {
  const { username } = req.query;
  console.debug('validating:', username);

  // Use shared validation logic from utils
  const validationResult = await validateUsernameWithGraphQL(username, axios, GET_TRAILBLAZER_RANK);

  // Return appropriate status code based on validation result
  const statusCode =
    validationResult.state === 'invalid' && validationResult.message === 'Internal server error' ? 500 : 200;

  return res.status(statusCode).json(validationResult);
}
