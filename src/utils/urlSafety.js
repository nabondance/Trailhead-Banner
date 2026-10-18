import dns from 'dns';
import net from 'net';
import axios from 'axios';

/**
 * SSRF-safe outbound image fetching.
 *
 * A hostname prefix blocklist is not enough: bracketed IPv6 literals
 * ([::1], [::ffff:127.0.0.1]), shorthand IPv4 (http://0/), DNS names that
 * resolve to private addresses (127.0.0.1.nip.io) and redirects to internal
 * hosts all slip through. Here every address is checked against private and
 * reserved CIDR ranges at connect time (custom DNS lookup), and redirects
 * are followed manually so each hop is re-validated.
 */

// [network, prefix length] — private, loopback, link-local, CGNAT, reserved
const BLOCKED_IPV4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const MAX_REDIRECTS = 3;

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isBlockedIpv4(ip) {
  const value = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([network, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToInt(network) & mask) >>> 0;
  });
}

/**
 * Expand an IPv6 address into 8 numeric hextets (handles "::" and an
 * embedded dotted IPv4 tail such as ::ffff:127.0.0.1).
 * @param {string} ip
 * @returns {number[]|null}
 */
function parseIpv6(ip) {
  let address = ip.split('%')[0]; // drop zone index
  const v4Tail = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const v4 = ipv4ToInt(v4Tail[1]);
    address = address.slice(0, -v4Tail[1].length) + `${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.includes('::') ? address.split('::') : [address, null];
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (tail === null ? headParts.length !== 8 : missing < 0) return null;
  const parts = [...headParts, ...new Array(tail === null ? 0 : missing).fill('0'), ...tailParts];
  const hextets = parts.map((p) => parseInt(p || '0', 16));
  return hextets.some((h) => Number.isNaN(h) || h < 0 || h > 0xffff) ? null : hextets;
}

function isBlockedIpv6(ip) {
  const h = parseIpv6(ip);
  if (!h) return true; // unparseable — refuse
  const embeddedV4 = () => `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;

  if (h.every((x) => x === 0)) return true; // ::
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::a.b.c.d)
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) return isBlockedIpv4(embeddedV4());
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return isBlockedIpv4(embeddedV4());
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  return false;
}

/**
 * @param {string} ip - IPv4 or IPv6 address
 * @returns {boolean} true when the address is private, loopback, link-local or reserved
 */
export function isBlockedIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

/**
 * Validate a URL's protocol and, when the host is an IP literal, its address.
 * Hostnames are checked at connect time by safeLookup (covers DNS rebinding).
 * @param {string} url
 * @returns {URL}
 * @throws {Error} when the URL is not a public http(s) URL
 */
export function assertPublicUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Invalid protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with credentials are not allowed');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new Error(`Private/internal address blocked: ${host}`);
  }
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error(`Private/internal address blocked: ${host}`);
  }
  return parsed;
}

/**
 * dns.lookup replacement that refuses private/reserved addresses, so the
 * check applies to the address actually connected to.
 */
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const blocked = addresses.find((a) => isBlockedIp(a.address));
    if (blocked) {
      return callback(new Error(`Private/internal address blocked: ${hostname} -> ${blocked.address}`));
    }
    if (options?.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

/**
 * Fetch a public URL with SSRF protection, a byte limit and manual redirects.
 * @param {string} url
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=10000]
 * @param {number} [options.maxBytes=5MB]
 * @param {AbortSignal} [options.signal]
 * @param {Object} [options.headers]
 * @returns {Promise<Buffer>}
 */
export async function safeFetchBuffer(url, { timeoutMs = 10000, maxBytes = 5 * 1024 * 1024, signal, headers } = {}) {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(currentUrl);
    const response = await axios.get(currentUrl, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      signal,
      headers,
      lookup: safeLookup,
      maxRedirects: 0,
      maxContentLength: maxBytes,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    if (response.status >= 300) {
      const location = response.headers.location;
      if (!location) throw new Error(`Redirect without location from ${currentUrl}`);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return Buffer.from(response.data);
  }
  throw new Error(`Too many redirects for ${url}`);
}
