/**
 * Instaflow SEO Suite - Translation Key Parity Checker
 * Run via: node seo/lib/i18n/check-missing.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getFlattenedKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getFlattenedKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

export function checkMissingKeys() {
  const enPath = path.join(__dirname, 'en.json');
  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const enKeys = new Set(getFlattenedKeys(enData));

  const locales = ['es', 'fr', 'de'];
  const report = {};

  for (const loc of locales) {
    const locPath = path.join(__dirname, `${loc}.json`);
    if (!fs.existsSync(locPath)) {
      report[loc] = { missing: [...enKeys], totalMissing: enKeys.size };
      continue;
    }
    const locData = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    const locKeys = new Set(getFlattenedKeys(locData));

    const missing = [];
    for (const key of enKeys) {
      if (!locKeys.has(key)) {
        missing.push(key);
      }
    }
    report[loc] = {
      totalKeys: locKeys.size,
      missingCount: missing.length,
      missing
    };
  }

  return report;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = checkMissingKeys();
  console.log('--- i18n Translation Key Audit ---');
  console.log(JSON.stringify(results, null, 2));
}
