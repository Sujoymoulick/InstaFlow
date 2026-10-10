/**
 * Instaflow SEO Suite - Structured Data (JSON-LD & Microdata) Extractor & Validator
 */

export const SUPPORTED_SCHEMAS = {
  Article: {
    required: ['headline', 'author', 'publisher'],
    recommended: ['datePublished', 'dateModified', 'image', 'description']
  },
  BlogPosting: {
    required: ['headline', 'author', 'publisher'],
    recommended: ['datePublished', 'dateModified', 'image', 'description']
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
    customValidate: (data) => {
      const errs = [];
      const entities = Array.isArray(data.mainEntity) ? data.mainEntity : [data.mainEntity];
      if (!entities.length || !entities[0]) {
        errs.push('FAQPage mainEntity must contain question objects');
      } else {
        for (const item of entities) {
          if (!item.name && !item.text) errs.push('FAQ Question missing "name"');
          if (!item.acceptedAnswer || !item.acceptedAnswer.text) errs.push('FAQ Question missing "acceptedAnswer.text"');
        }
      }
      return errs;
    }
  },
  HowTo: {
    required: ['name', 'step'],
    recommended: ['description', 'totalTime', 'image']
  },
  Product: {
    required: ['name', 'offers'],
    recommended: ['image', 'description', 'brand', 'aggregateRating', 'sku', 'review']
  },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHoursSpecification', 'geo', 'image', 'priceRange', 'url']
  },
  Organization: {
    required: ['name', 'url'],
    recommended: ['logo', 'sameAs', 'contactPoint']
  },
  Person: {
    required: ['name'],
    recommended: ['jobTitle', 'url', 'sameAs', 'image', 'worksFor']
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
    customValidate: (data) => {
      const errs = [];
      const items = Array.isArray(data.itemListElement) ? data.itemListElement : [];
      if (items.length === 0) errs.push('BreadcrumbList itemListElement is empty');
      items.forEach((it, idx) => {
        if (!it.name && (!it.item || !it.item.name)) errs.push(`Breadcrumb item ${idx + 1} missing name`);
        if (it.position === undefined) errs.push(`Breadcrumb item ${idx + 1} missing position`);
      });
      return errs;
    }
  },
  SoftwareApplication: {
    required: ['name', 'offers', 'operatingSystem', 'applicationCategory'],
    recommended: ['aggregateRating', 'description', 'screenshot']
  },
  VideoObject: {
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'embedUrl', 'duration']
  },
  Event: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'offers', 'image', 'organizer']
  },
  Recipe: {
    required: ['name', 'image', 'recipeIngredient', 'recipeInstructions'],
    recommended: ['author', 'prepTime', 'cookTime', 'nutrition']
  }
};

/**
 * Extracts and parses all JSON-LD blocks from a document or HTML
 */
export function extractJsonLd(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const items = [];
  const parseErrors = [];

  for (const script of scripts) {
    const raw = (script.textContent || script.innerHTML || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      flattenGraph(parsed, items);
    } catch (err) {
      parseErrors.push({
        rawSnippet: raw.slice(0, 100),
        message: err.message
      });
    }
  }

  return { items, parseErrors };
}

function flattenGraph(obj, results) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    for (const sub of obj) flattenGraph(sub, results);
    return;
  }
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const sub of obj['@graph']) flattenGraph(sub, results);
    return;
  }
  if (obj['@type']) {
    results.push(obj);
  }
}

/**
 * Validates extracted schema items against rich result specifications
 */
export function validateSchemaItems(schemaItems = []) {
  const detectedTypes = [];
  const errors = [];
  const warnings = [];

  for (const item of schemaItems) {
    const rawType = item['@type'];
    const types = Array.isArray(rawType) ? rawType : [rawType];

    for (const type of types) {
      if (!type) continue;
      detectedTypes.push(type);
      const spec = SUPPORTED_SCHEMAS[type];

      if (!spec) {
        // Unknown or custom schema type
        continue;
      }

      // Check required fields
      for (const field of spec.required) {
        if (!hasField(item, field)) {
          errors.push({
            type,
            field,
            severity: 'critical',
            message: `Schema "${type}" is missing required field "${field}"`
          });
        }
      }

      // Check recommended fields
      for (const field of spec.recommended) {
        if (!hasField(item, field)) {
          warnings.push({
            type,
            field,
            severity: 'medium',
            message: `Schema "${type}" is missing recommended field "${field}"`
          });
        }
      }

      // Run custom validator if any
      if (spec.customValidate) {
        const customErrs = spec.customValidate(item);
        for (const msg of customErrs) {
          errors.push({ type, severity: 'high', message: msg });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    detectedTypes: [...new Set(detectedTypes)],
    totalItems: schemaItems.length,
    errors,
    warnings
  };
}

function hasField(obj, path) {
  if (!obj) return false;
  const parts = path.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined) return false;
    curr = curr[p];
  }
  if (curr === null || curr === undefined || curr === '') return false;
  if (Array.isArray(curr) && curr.length === 0) return false;
  return true;
}

/**
 * Generates valid JSON-LD template
 */
export function generateSchema(type, fields = {}) {
  const base = {
    '@context': 'https://schema.org',
    '@type': type,
    ...fields
  };
  return JSON.stringify(base, null, 2);
}
