import { fetchCompanyData, parseUsernameInput, FETCH_CHUNK_SIZE } from '../../../utils/companyFetchUtils';
import { saveCompanyChunk } from '../../../utils/companyChunkStore';

// Stop starting new users after this long. A request already in flight can
// still take up to the 15s GraphQL timeout, so the function's maxDuration
// (30s, see vercel.json) leaves room for it and the chunk save
const FETCH_TIME_BUDGET_MS = 10000;

/**
 * Fetch Trailhead data for a small chunk of usernames.
 * The company banner form splits its username list into chunks and calls this
 * endpoint sequentially so it can show fetch progress. The fetched data stays
 * server-side: it is stored under an opaque token, and the form later sends
 * only the tokens to /api/banner/company — so the render endpoint never trusts
 * user data (image URLs, counts) coming from the browser.
 *
 * Users that could not be fetched within the time budget or were still
 * rate-limited are returned in `deferred` for the client to retry.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const usernames = parseUsernameInput(body.usernames);

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
    const { resolved, failed, deferred } = await fetchCompanyData(usernames, {
      queryOptions: body.options || {},
      deadline: startTime + FETCH_TIME_BUDGET_MS,
    });

    // Still rate-limited after the server-side retries: let the client retry later
    const retryable = [...deferred, ...failed.filter((f) => f.status === 'rate_limited').map((f) => f.username)];
    const finalFailed = failed.filter((f) => f.status !== 'rate_limited');

    // A chunk where every user was deferred has nothing to keep: no token
    const token =
      resolved.length > 0 || finalFailed.length > 0 ? await saveCompanyChunk({ resolved, failed: finalFailed }) : null;
    console.log(
      `[Company Fetch] ${usernames.length} usernames | resolved: ${resolved.length} | failed: ${finalFailed.length} | deferred: ${retryable.length} | ${Date.now() - startTime}ms`
    );
    return res.status(200).json({
      token,
      resolvedCount: resolved.length,
      failed: finalFailed,
      deferred: retryable,
    });
  } catch (error) {
    console.error('Error fetching company data chunk:', error?.message);
    return res.status(500).json({ error: 'Failed to fetch Trailhead data. Please try again.' });
  }
}
