import { getLocal } from '../../../utils/cacheUtils';

const AGENTBLAZER_NAMES = new Set(['Champion.png', 'Innovator.png', 'Legend.png']);
const RANK_NAME_PATTERN = /^[a-z0-9-]+\.png$/;

/**
 * Serves repo-stored artwork (high-res first) for ranks and Agentblazer
 * levels. The Trailhead API's imageUrl for these is either low-res or, for
 * Agentblazer, an HTML page — same reason the rewind renderer uses getLocal.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, name, year } = req.query;

  const validName =
    (type === 'Agentblazer' && AGENTBLAZER_NAMES.has(name)) || (type === 'Rank' && RANK_NAME_PATTERN.test(name || ''));
  if (!validName) {
    return res.status(400).json({ error: 'Invalid type or name' });
  }
  if (year && !/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const yearFilter = type === 'Agentblazer' && year ? year : undefined;
  const attempts = [
    ...(yearFilter
      ? [() => getLocal(name, type, 'high', yearFilter), () => getLocal(name, type, 'normal', yearFilter)]
      : []),
    () => getLocal(name, type, 'high'),
    () => getLocal(name, type, 'normal'),
  ];

  for (const attempt of attempts) {
    try {
      const buffer = await attempt();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.status(200).send(buffer);
    } catch {
      // try the next variant
    }
  }

  return res.status(404).json({ error: 'Local image not found' });
}
