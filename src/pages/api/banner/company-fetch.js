import { fetchCompanyData, parseUsernames, FETCH_CHUNK_SIZE } from '../../../utils/companyFetchUtils';

/**
 * Fetch Trailhead data for a small chunk of usernames.
 * The company banner form splits its username list into chunks and calls this
 * endpoint sequentially so it can show fetch progress, then sends the collected
 * data to /api/banner/company for aggregation and rendering. Keeping each call
 * small also stays under Trailhead's per-IP rate limit and Vercel's function
 * duration limit.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const rawUsernames = body.usernames;
  const usernames = Array.isArray(rawUsernames)
    ? rawUsernames.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim())
    : parseUsernames(typeof rawUsernames === 'string' ? rawUsernames : '');

  if (usernames.length === 0) {
    return res.status(400).json({ error: 'At least one username is required', validationError: true });
  }

  if (usernames.length > FETCH_CHUNK_SIZE) {
    return res.status(400).json({
      error: `Maximum ${FETCH_CHUNK_SIZE} usernames per fetch request`,
      validationError: true,
    });
  }

  try {
    const startTime = Date.now();
    // Options trim the per-user query set (e.g. skip MVP when neither the
    // counters nor the CSV need it) — see computeQueryNeeds
    const { resolved, failed } = await fetchCompanyData(usernames, { queryOptions: body.options || {} });
    console.log(
      `[Company Fetch] ${usernames.length} usernames | resolved: ${resolved.length} | failed: ${failed.length} | ${Date.now() - startTime}ms`
    );
    return res.status(200).json({ resolved, failed });
  } catch (error) {
    console.error('Error fetching company data chunk:', error?.message);
    return res.status(500).json({ error: 'Failed to fetch Trailhead data. Please try again.' });
  }
}
