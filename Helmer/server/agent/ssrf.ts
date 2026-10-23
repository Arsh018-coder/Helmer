/**
 * server/agent/ssrf.ts — block server-side request forgery in `fetch_page`.
 *
 * The agent fetches URLs that a language model chose, which means the "attacker" is
 * sometimes the model itself. Without this guard a page could point us at
 * `http://169.254.169.254/` (cloud metadata) or `http://127.0.0.1:5432/` and turn the
 * worker into a proxy for the internal network.
 *
 * Defence (AGENTS.md section 13), using only Node built-ins:
 *  - only `http:` and `https:`;
 *  - no credentials in the URL;
 *  - resolve the hostname with `dns.lookup` and reject every address that falls in a
 *    non-public range, using `net.BlockList`;
 *  - re-run the whole check on **every** redirect, because redirects are followed
 *    manually (a 302 to a private address is the classic bypass).
 */

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { AppError } from '../errors';

/** Address ranges that must never be reachable from the agent. */
const blocked = new BlockList();

// IPv4: unspecified, private, loopback, CGNAT, link-local (incl. cloud metadata),
// documentation, benchmarking, multicast and reserved.
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.0.0.0', 24, 'ipv4');
blocked.addSubnet('192.0.2.0', 24, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('198.18.0.0', 15, 'ipv4');
blocked.addSubnet('198.51.100.0', 24, 'ipv4');
blocked.addSubnet('203.0.113.0', 24, 'ipv4');
blocked.addSubnet('224.0.0.0', 4, 'ipv4');
blocked.addSubnet('240.0.0.0', 4, 'ipv4');

// IPv6: unspecified, loopback, unique-local, link-local, multicast, documentation.
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');

/** True when a literal IP address is not routable on the public internet. */
export function isBlockedAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) must be unwrapped or the IPv6 check misses it.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) return isBlockedAddress(mapped[1]);

  const family = isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) return blocked.check(address, 'ipv6');
  return true; // anything unparseable is treated as unsafe
}

/**
 * Validate a URL and prove its hostname resolves only to public addresses.
 *
 * @returns the parsed URL, ready to fetch.
 * @throws AppError 400 `bad_request` for a non-http scheme, embedded credentials, a
 *         hostname that does not resolve, or any address in a blocked range.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(400, 'bad_request', `Not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, 'bad_request', `Only http and https are allowed, got ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new AppError(400, 'bad_request', 'Credentials in the URL are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  // A literal address needs no DNS round-trip but the same range check.
  if (isIP(hostname) !== 0) {
    if (isBlockedAddress(hostname)) {
      throw new AppError(400, 'bad_request', `Blocked address: ${hostname}`);
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(400, 'bad_request', `Cannot resolve host: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new AppError(400, 'bad_request', `Cannot resolve host: ${hostname}`);
  }

  // Every answer must be public: a host with one private A record is still a risk.
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new AppError(400, 'bad_request', `Host ${hostname} resolves to a blocked address`);
    }
  }

  return url;
}
