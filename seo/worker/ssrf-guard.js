/**
 * Instaflow SEO Suite - SSRF Security Guard
 * Resolves and validates target URLs to prevent server-side request forgery (SSRF),
 * blocking internal IPs, cloud metadata endpoints, loopback, non-standard ports,
 * and domains that resolve to private network ranges via DNS lookup.
 */

// Denied private & reserved IPv4 CIDR definitions for reference and checks
export const BLOCKED_IPV4_RANGES = [
  { prefix: '0.', mask: '0.0.0.0/8' },
  { prefix: '10.', mask: '10.0.0.0/8' },
  { prefix: '127.', mask: '127.0.0.0/8' },          // Loopback
  { prefix: '169.254.', mask: '169.254.0.0/16' },   // Link-local / Cloud metadata (AWS, GCP, Azure)
  { prefix: '172.16.', mask: '172.16.0.0/12' },
  { prefix: '172.17.', mask: '172.16.0.0/12' },
  { prefix: '172.18.', mask: '172.16.0.0/12' },
  { prefix: '172.19.', mask: '172.16.0.0/12' },
  { prefix: '172.2', mask: '172.16.0.0/12' },
  { prefix: '172.3', mask: '172.16.0.0/12' },
  { prefix: '192.168.', mask: '192.168.0.0/16' },
  { prefix: '100.64.', mask: '100.64.0.0/10' },     // Shared address space (CGNAT)
  { prefix: '198.18.', mask: '198.18.0.0/15' },     // Benchmarking
  { prefix: '224.', mask: '224.0.0.0/4' },          // Multicast
  { prefix: '240.', mask: '240.0.0.0/4' }           // Reserved
];

export const ALLOWED_PORTS = new Set(['80', '443', '8080', '8443', '']);

/**
 * Checks whether an IPv4 or IPv6 string belongs to a private/reserved/internal IP range
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let cleanIp = ip.trim().toLowerCase();

  // Strip brackets if IPv6 literal like [::1]
  if (cleanIp.startsWith('[') && cleanIp.endsWith(']')) {
    cleanIp = cleanIp.slice(1, -1);
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.slice(7);
  }

  // IPv4 numeric checks
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp)) {
    const octets = cleanIp.split('.').map(Number);
    if (octets.some(o => o < 0 || o > 255)) return true;

    // 0.0.0.0/8 (Broadcast / Current network)
    if (octets[0] === 0) return true;
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
    // 198.18.0.0/15 (Benchmarking: 198.18.0.0 - 198.19.255.255)
    if (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) return true;
    // 224.0.0.0/4 (Multicast)
    if (octets[0] >= 224 && octets[0] <= 239) return true;
    // 240.0.0.0/4 (Reserved / Broadcast)
    if (octets[0] >= 240) return true;

    return false;
  }

  // IPv6 checks
  if (cleanIp.includes(':')) {
    // Loopback ::1
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1' || /^0*(:0*)*:1$/.test(cleanIp)) return true;
    // Unspecified ::
    if (cleanIp === '::' || /^0*(:0*)+$/.test(cleanIp)) return true;
    // Link-local fe80::/10
    if (/^fe[89ab]/i.test(cleanIp)) return true;
    // Unique local address fc00::/7 (fc00:: - fdff::)
    if (/^f[cd]/i.test(cleanIp)) return true;
    // Multicast ff00::/8
    if (/^ff/i.test(cleanIp)) return true;
    // Documentation 2001:db8::/32
    if (/^2001:db8/i.test(cleanIp)) return true;

    return false;
  }

  // Pure integer representation of IP (e.g. 2130706433 for 127.0.0.1)
  if (/^\d+$/.test(cleanIp)) {
    const num = parseInt(cleanIp, 10);
    if (!isNaN(num)) {
      const b0 = (num >>> 24) & 255;
      const b1 = (num >>> 16) & 255;
      return isPrivateIp(`${b0}.${b1}.${(num >>> 8) & 255}.${num & 255}`);
    }
  }

  return false;
}

/**
 * Synchronous URL syntax and string-based SSRF validation
 * @param {string} urlString 
 * @returns {{ safe: boolean, error?: string, url?: URL }}
 */
export function validateUrlSafety(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, error: 'URL must be a non-empty string' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (e) {
    return { safe: false, error: 'Invalid URL syntax' };
  }

  // Protocol check: Only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  // Disallow user credentials embedded in URL (e.g. http://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { safe: false, error: 'URLs containing user credentials are not allowed for security reasons.' };
  }

  // Port check
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: `Disallowed port "${parsed.port}". Only standard web ports (80, 443, 8080, 8443) are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { safe: false, error: 'URL hostname cannot be empty.' };
  }

  // Block localhost, link-local, and internal hostnames
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home.arpa') ||
    hostname === '169.254.169.254' || // Cloud metadata endpoint (AWS/GCP/Azure)
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname === '[::]' ||
    hostname === '::1' ||
    hostname === '::'
  ) {
    return { safe: false, error: `Access to private/internal host "${hostname}" is blocked.` };
  }

  // Check prefix against blocked ranges for backward compatibility
  for (const range of BLOCKED_IPV4_RANGES) {
    if (hostname.startsWith(range.prefix)) {
      return { safe: false, error: `Access to private IP range (${range.mask}) is blocked.` };
    }
  }

  // Deep check if hostname is an IP address
  if (isPrivateIp(hostname)) {
    return { safe: false, error: `Access to private or reserved IP address "${hostname}" is blocked.` };
  }

  return { safe: true, url: parsed };
}

/**
 * Asynchronous SSRF validation including DNS resolution to protect against DNS rebinding & nip.io bypasses
 * @param {string} urlString 
 * @param {object} [options]
 * @param {object} [options.dnsLookup] Custom DNS lookup function (defaults to node:dns/promises lookup)
 * @returns {Promise<{ safe: boolean, error?: string, url?: URL, resolvedIps?: string[] }>}
 */
export async function validateUrlSafetyAsync(urlString, options = {}) {
  const syncCheck = validateUrlSafety(urlString);
  if (!syncCheck.safe) {
    return syncCheck;
  }

  const parsed = syncCheck.url;
  const hostname = parsed.hostname.toLowerCase();

  // If hostname is already verified IP literal, no need for DNS resolution
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[') || hostname.includes(':')) {
    return { safe: true, url: parsed, resolvedIps: [hostname] };
  }

  try {
    // Dynamically resolve DNS in Node.js runtime environments
    let lookupFn = options.dnsLookup;
    if (!lookupFn) {
      try {
        const dnsPromises = await import('node:dns/promises');
        lookupFn = dnsPromises.lookup;
      } catch {
        // Fallback or non-Node environment (e.g. edge worker without node:dns)
        lookupFn = null;
      }
    }

    if (typeof lookupFn === 'function') {
      const records = await lookupFn(hostname, { all: true });
      const resolvedIps = [];

      for (const rec of (Array.isArray(records) ? records : [records])) {
        const ip = rec.address || rec;
        if (ip) {
          resolvedIps.push(ip);
          if (isPrivateIp(ip)) {
            return {
              safe: false,
              error: `Host "${hostname}" resolved to private/internal IP (${ip}). Request is blocked.`,
              url: parsed
            };
          }
        }
      }

      if (resolvedIps.length === 0) {
        return {
          safe: false,
          error: `DNS resolution returned no IP addresses for host "${hostname}".`,
          url: parsed
        };
      }

      return { safe: true, url: parsed, resolvedIps };
    }
  } catch (dnsErr) {
    // DNS resolution failure (e.g. ENOTFOUND, EAI_AGAIN)
    return {
      safe: false,
      error: `Could not resolve hostname "${hostname}" (DNS error: ${dnsErr.code || dnsErr.message || 'Host not found'}). Please check if the domain exists and is publicly accessible.`,
      url: parsed
    };
  }

  return { safe: true, url: parsed };
}
