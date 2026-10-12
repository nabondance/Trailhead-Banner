// GitHub pull request helpers for workflows triggered by `workflow_run`.

const API = 'https://api.github.com';

function headers(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...extra };
}

async function request(url, options, action) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error(`Network error trying to ${action}: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to ${action} (${res.status} ${res.statusText}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Resolve the open pull request a workflow run belongs to, from the
 * `workflow_run` event fields. For pull requests coming from forks
 * `workflow_run.pull_requests` is empty, and a PR number stored in an artifact
 * could point at any other pull request, so neither is used.
 *
 * Returns undefined when no open PR is at that commit (closed or updated since).
 */
export async function findPullRequestNumber({ repo, token, headOwner, headBranch, headSha }) {
  const head = encodeURIComponent(`${headOwner}:${headBranch}`);
  const prs = await request(
    `${API}/repos/${repo}/pulls?state=open&head=${head}&per_page=100`,
    { headers: headers(token) },
    'list pull requests'
  );
  return Array.isArray(prs) ? prs.find((pr) => pr.head?.sha === headSha)?.number : undefined;
}

/**
 * Post `body` as a PR comment, or update the existing comment containing
 * `sentinel`. `body` must include `sentinel`.
 */
export async function upsertComment({ repo, token, prNumber, sentinel, body }) {
  const comments = await request(
    `${API}/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    { headers: headers(token) },
    'list comments'
  );
  if (!Array.isArray(comments)) throw new Error('Unexpected response shape when listing comments');

  const existing = comments.find((c) => c.body?.includes(sentinel));
  const options = {
    headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ body }),
  };

  if (existing) {
    await request(existing.url, { ...options, method: 'PATCH' }, 'update comment');
    console.log(`Updated existing comment #${existing.id}`);
  } else {
    await request(`${API}/repos/${repo}/issues/${prNumber}/comments`, { ...options, method: 'POST' }, 'post comment');
    console.log('Posted new comment');
  }
}
