/**
 * Instaflow SEO Suite - Redirect Rules Generator
 */

export function generateRedirectRules(redirectList = [], format = 'htaccess') {
  const items = redirectList.map(item => {
    let source = item.from || item.source || '';
    let target = item.to || item.destination || item.target || '';
    let status = item.status || (item.permanent ? 301 : 302) || 301;
    return { source: source.trim(), target: target.trim(), status: parseInt(status, 10) };
  }).filter(i => i.source && i.target);

  if (items.length === 0) return '# No redirect rules defined.';

  switch (format) {
    case 'htaccess':
      return [
        '# ----------------------------------------------------------------------',
        '# Instaflow SEO Suite - Apache .htaccess 301/302 Redirects',
        '# ----------------------------------------------------------------------',
        'RewriteEngine On',
        ...items.map(i => {
          const flag = i.status === 301 ? 'R=301,L' : 'R=302,L';
          const src = i.source.replace(/^\//, '^').replace(/\/$/, '') + '/?$';
          return `RewriteRule ${src} ${i.target} [${flag}]`;
        })
      ].join('\n');

    case 'nginx':
      return [
        '# ----------------------------------------------------------------------',
        '# Instaflow SEO Suite - Nginx Server Block Redirects',
        '# ----------------------------------------------------------------------',
        ...items.map(i => {
          const type = i.status === 301 ? 'permanent' : 'redirect';
          return `rewrite ^${i.source.replace(/\/$/, '')}/?$ ${i.target} ${type};`;
        })
      ].join('\n');

    case 'netlify':
      return [
        '# ----------------------------------------------------------------------',
        '# Instaflow SEO Suite - Netlify _redirects',
        '# ----------------------------------------------------------------------',
        ...items.map(i => `${i.source}  ${i.target}  ${i.status}!`)
      ].join('\n');

    case 'vercel':
      const vercelConfig = {
        redirects: items.map(i => ({
          source: i.source,
          destination: i.target,
          permanent: i.status === 301
        }))
      };
      return JSON.stringify(vercelConfig, null, 2);

    default:
      return '# Unsupported format';
  }
}
