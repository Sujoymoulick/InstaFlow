/**
 * Instaflow SEO Suite - XML Sitemap Parser, Validator & Generator
 */

export function parseSitemapXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    return { urls: [], sitemaps: [], isIndex: false, errors: ['Empty sitemap content'] };
  }

  const errors = [];
  const urls = [];
  const sitemaps = [];

  const isIndex = /<sitemapindex\b/i.test(xmlString);

  if (isIndex) {
    const sitemapMatches = xmlString.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi);
    for (const match of sitemapMatches) {
      const locMatch = match[1].match(/<loc>([\s\S]*?)<\/loc>/i);
      const lastmodMatch = match[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
      if (locMatch) {
        sitemaps.push({
          loc: locMatch[1].trim(),
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : null
        });
      }
    }
  } else {
    const urlMatches = xmlString.matchAll(/<url>([\s\S]*?)<\/url>/gi);
    for (const match of urlMatches) {
      const block = match[1];
      const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
      const lastmodMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
      const changefreqMatch = block.match(/<changefreq>([\s\S]*?)<\/changefreq>/i);
      const priorityMatch = block.match(/<priority>([\s\S]*?)<\/priority>/i);

      if (locMatch) {
        const loc = locMatch[1].trim();
        const lastmod = lastmodMatch ? lastmodMatch[1].trim() : null;
        const changefreq = changefreqMatch ? changefreqMatch[1].trim() : null;
        const priority = priorityMatch ? parseFloat(priorityMatch[1].trim()) : null;

        urls.push({ loc, lastmod, changefreq, priority });
      }
    }
  }

  // Validate limits & rules
  const byteSize = new TextEncoder().encode(xmlString).length;
  const maxBytes = 50 * 1024 * 1024; // 50MB
  if (byteSize > maxBytes) {
    errors.push(`Sitemap size exceeds 50MB limit (${(byteSize / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const totalCount = isIndex ? sitemaps.length : urls.length;
  if (totalCount > 50000) {
    errors.push(`Sitemap contains ${totalCount} entries, exceeding the 50,000 URL limit`);
  }

  // Duplicate check
  const seenUrls = new Set();
  const duplicates = [];
  for (const item of (isIndex ? sitemaps : urls)) {
    if (seenUrls.has(item.loc)) {
      duplicates.push(item.loc);
    }
    seenUrls.add(item.loc);
  }
  if (duplicates.length > 0) {
    errors.push(`Found ${duplicates.length} duplicate URL(s)`);
  }

  return {
    isIndex,
    urls,
    sitemaps,
    totalEntries: totalCount,
    duplicates,
    byteSize,
    errors
  };
}

export function generateSitemapXml(urls = []) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const now = new Date().toISOString().split('T')[0];

  for (const item of urls) {
    const loc = typeof item === 'string' ? item : item.loc;
    const lastmod = (typeof item === 'object' && item.lastmod) ? item.lastmod : now;
    const changefreq = (typeof item === 'object' && item.changefreq) ? item.changefreq : 'weekly';
    const priority = (typeof item === 'object' && item.priority !== undefined) ? item.priority : '0.8';

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(loc)}</loc>\n`;
    xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    xml += `    <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
