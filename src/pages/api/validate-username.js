import { validateUsername } from '../../banner/api/validators';

export default async function handler(req, res) {
  const { username } = req.query;
  console.debug('validating:', username);

  const validationResult = await validateUsername(username);

  const statusCode =
    validationResult.state === 'invalid' && validationResult.message === 'Internal server error' ? 500 : 200;

  return res.status(statusCode).json(validationResult);
}
