/**
 * Instaflow SEO Suite - HTML Parser & DOM Utilities
 * Pure & safe parser: Never executes scripts, uses DOMParser in browser,
 * and inert DOM-like fallback in Node.js test runner if DOMParser is unavailable.
 */

export function parseHTML(htmlString, customDOMParser = null) {
  if (!htmlString || typeof htmlString !== 'string') {
    return createEmptyDocument();
  }

  // Use DOMParser if available (Browser or jsdom / happy-dom)
  const ParserClass = customDOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);

  if (ParserClass) {
    try {
      const parser = new ParserClass();
      return parser.parseFromString(htmlString, 'text/html');
    } catch (e) {
      console.warn('DOMParser failed, falling back to minimal parser:', e);
    }
  }

  return parseMinimalDOM(htmlString);
}

/**
 * Minimal inert DOM tree for Node.js unit tests without external heavy deps
 */
export function parseMinimalDOM(htmlString) {
  const cleanHtml = htmlString.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Helper to extract tag matches
  function getElements(tag) {
    const regex = new RegExp(`<${tag}\\b([^>]*)>(?:([\\s\\S]*?)<\\/${tag}>)?`, 'gi');
    const elements = [];
    let match;
    while ((match = regex.exec(htmlString)) !== null) {
      const attrStr = match[1] || '';
      const innerHTML = match[2] || '';
      const attributes = parseAttributes(attrStr);
      elements.push({
        tagName: tag.toUpperCase(),
        attributes,
        getAttribute: (name) => attributes[name.toLowerCase()] ?? null,
        hasAttribute: (name) => attributes[name.toLowerCase()] !== undefined,
        textContent: stripTags(innerHTML),
        innerHTML: innerHTML
      });
    }
    // Also handle self-closing / void elements
    if (['meta', 'link', 'img', 'input', 'hr', 'br'].includes(tag.toLowerCase())) {
      const voidRegex = new RegExp(`<${tag}\\b([^>]*)\\/?>`, 'gi');
      let vMatch;
      while ((vMatch = voidRegex.exec(htmlString)) !== null) {
        const attrStr = vMatch[1] || '';
        const attributes = parseAttributes(attrStr);
        // Avoid duplicate if already matched
        if (!elements.some(e => JSON.stringify(e.attributes) === JSON.stringify(attributes))) {
          elements.push({
            tagName: tag.toUpperCase(),
            attributes,
            getAttribute: (name) => attributes[name.toLowerCase()] ?? null,
            hasAttribute: (name) => attributes[name.toLowerCase()] !== undefined,
            textContent: '',
            innerHTML: ''
          });
        }
      }
    }
    return elements;
  }

  function parseAttributes(attrStr) {
    const attrs = {};
    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = attrRegex.exec(attrStr)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : '';
      attrs[key] = decodeHTMLEntities(val);
    }
    return attrs;
  }

  // Extract head, body, title, lang
  const headMatch = htmlString.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : htmlString;
  const titleMatch = htmlString.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHTMLEntities(stripTags(titleMatch[1])).trim() : '';

  const htmlTagMatch = htmlString.match(/<html\b([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? parseAttributes(htmlTagMatch[1]) : {};
  const lang = htmlAttrs['lang'] || '';

  const doc = {
    title,
    characterSet: 'UTF-8',
    documentElement: {
      lang: lang,
      getAttribute: (name) => htmlAttrs[name.toLowerCase()] ?? null,
      hasAttribute: (name) => htmlAttrs[name.toLowerCase()] !== undefined,
    },
    head: {
      innerHTML: headHtml
    },
    body: {
      textContent: stripTags(htmlString.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '')),
      innerHTML: htmlString
    },
    querySelectorAll: (selector) => {
      const selectors = selector.split(',').map(s => s.trim());
      let results = [];
      for (const sel of selectors) {
        if (sel === 'title') {
          if (title) results.push({ tagName: 'TITLE', textContent: title, innerHTML: title });
        } else if (sel.startsWith('meta')) {
          const metas = getElements('meta');
          results = results.concat(filterBySelector(metas, sel));
        } else if (sel.startsWith('link')) {
          const links = getElements('link');
          results = results.concat(filterBySelector(links, sel));
        } else if (sel.startsWith('h1')) {
          results = results.concat(getElements('h1'));
        } else if (sel.startsWith('h2')) {
          results = results.concat(getElements('h2'));
        } else if (sel.startsWith('h3')) {
          results = results.concat(getElements('h3'));
        } else if (sel.startsWith('h4')) {
          results = results.concat(getElements('h4'));
        } else if (sel.startsWith('h5')) {
          results = results.concat(getElements('h5'));
        } else if (sel.startsWith('h6')) {
          results = results.concat(getElements('h6'));
        } else if (sel.startsWith('a')) {
          results = results.concat(filterBySelector(getElements('a'), sel));
        } else if (sel.startsWith('img')) {
          results = results.concat(filterBySelector(getElements('img'), sel));
        } else if (sel.startsWith('script')) {
          results = results.concat(filterBySelector(getElements('script'), sel));
        } else if (sel.startsWith('style')) {
          results = results.concat(getElements('style'));
        } else {
          // generic tag search
          const tag = sel.match(/^[a-zA-Z0-9]+/)?.[0];
          if (tag) {
            results = results.concat(filterBySelector(getElements(tag), sel));
          }
        }
      }
      return results;
    },
    querySelector: (selector) => {
      const all = doc.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    getElementsByTagName: (tag) => getElements(tag)
  };

  return doc;
}

function filterBySelector(elements, sel) {
  const attrMatch = sel.match(/\[([a-zA-Z0-9_:-]+)(?:\s*([*^$~|]?=)\s*["']?([^"']*)["']?)?\]/);
  if (!attrMatch) return elements;
  const [_, attrName, op, expectedVal] = attrMatch;
  return elements.filter(el => {
    const val = el.getAttribute(attrName);
    if (val === null) return false;
    if (!op) return true;
    if (op === '=') return val.toLowerCase() === expectedVal.toLowerCase();
    if (op === '*=') return val.toLowerCase().includes(expectedVal.toLowerCase());
    if (op === '^=') return val.toLowerCase().startsWith(expectedVal.toLowerCase());
    if (op === '$=') return val.toLowerCase().endsWith(expectedVal.toLowerCase());
    return true;
  });
}

function createEmptyDocument() {
  return {
    title: '',
    characterSet: 'UTF-8',
    documentElement: { lang: '', getAttribute: () => null, hasAttribute: () => false },
    head: { innerHTML: '' },
    body: { textContent: '', innerHTML: '' },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementsByTagName: () => []
  };
}

export function stripTags(str) {
  if (!str) return '';
  return str
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeHTMLEntities(text) {
  if (!text) return '';
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, match => entities[match] || match);
}

/**
 * Extracts visible text content, headings outline, words, and links
 */
export function extractPageAnatomy(doc, htmlString = '') {
  const headings = [];
  const headingEls = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const el of headingEls) {
    const level = parseInt(el.tagName?.substring(1) || '1', 10);
    headings.push({
      level,
      text: (el.textContent || '').trim()
    });
  }

  const rawText = doc.body ? (doc.body.textContent || '') : stripTags(htmlString);
  const words = rawText.match(/[\p{L}\p{N}_-]+/gu) || [];
  const wordCount = words.length;

  const links = doc.querySelectorAll('a[href]');
  const images = doc.querySelectorAll('img');

  return {
    title: doc.title || '',
    wordCount,
    headings,
    totalHeadings: headings.length,
    h1Count: headings.filter(h => h.level === 1).length,
    linkCount: links.length,
    imageCount: images.length,
    rawText: rawText.slice(0, 50000)
  };
}
