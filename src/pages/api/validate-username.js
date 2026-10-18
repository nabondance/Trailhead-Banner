import { validateUsername } from '../../banner/api/validators';
import { checkRateLimit } from '../../utils/rateLimit';

export default async function handler(req, res) {
  const { allowed, retryAfterSeconds } = await checkRateLimit(req, 'validateUsername');
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      valid: false,
      state: 'invalid',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }

  const { username } = req.query;
  console.debug('validating:', username);

  const validationResult = await validateUsername(username);

  const statusCode =
    validationResult.state === 'invalid' && validationResult.message === 'Internal server error' ? 500 : 200;

  return res.status(statusCode).json(validationResult);
}
