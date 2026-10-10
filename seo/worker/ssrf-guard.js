/**
 * Instaflow SEO Suite - SSRF Security Guard
 * Resolves and validates target URLs to prevent server-side request forgery (SSRF),
 * blocking internal IPs, cloud metadata endpoints, loopback and non-standard ports.
 */

// Denied private & reserved IPv4 CIDRs
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
  { prefix: '100.64.', mask: '100.64.0.0/10' },     // Shared address space
  { prefix: '198.18.', mask: '198.18.0.0/15' },     // Benchmarking
  { prefix: '224.', mask: '224.0.0.0/4' },          // Multicast
  { prefix: '240.', mask: '240.0.0.0/4' }           // Reserved
];

export const ALLOWED_PORTS = new Set(['80', '443', '8080', '8443', '']);

/**
 * Validates a URL against SSRF attack vectors
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

  // Port check
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: `Disallowed port "${parsed.port}". Only standard web ports (80, 443, 8080, 8443) are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, link-local and internal hostnames
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '169.254.169.254' || // Cloud metadata endpoint
    hostname === 'metadata.google.internal' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    return { safe: false, error: `Access to private/internal host "${hostname}" is blocked.` };
  }

  // Check against blocked IP prefixes
  for (const range of BLOCKED_IPV4_RANGES) {
    if (hostname.startsWith(range.prefix)) {
      return { safe: false, error: `Access to private IP range (${range.mask}) is blocked.` };
    }
  }

  return { safe: true, url: parsed };
}
