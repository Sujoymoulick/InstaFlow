/**
 * Instaflow SEO Suite - Hreflang Validator & Generator
 */

// Common ISO 639-1 valid language codes
export const ISO_639_1 = new Set([
  'aa','ab','af','ak','sq','am','ar','an','hy','as','av','ae','ay','az','ba','bm','bn','bh','bi','bs','br','bg','my','ca',
  'ch','ce','ny','zh','cu','cv','kw','co','cr','hr','cs','da','dv','nl','dz','en','eo','et','ee','fo','fj','fi','fr','fy',
  'ff','gl','lg','ka','de','el','kl','gn','gu','ht','ha','he','hz','hi','ho','hu','is','io','ig','id','ia','ie','iu','ik',
  'ga','it','ja','jv','kn','kr','ks','kk','km','ki','rw','ky','kv','kg','ko','ku','kj','la','lb','lu','lg','li','ln','lo',
  'lt','lu','lv','gv','mk','mg','ms','ml','mt','mi','mr','mh','mn','na','nv','nd','nr','ng','ne','no','nb','nn','oc','oj',
  'cu','or','om','os','pi','ps','fa','pl','pt','pa','qu','rm','rn','ro','ru','sa','sc','sd','se','sm','sg','sr','gd','sn',
  'si','sk','sl','so','st','es','su','sw','ss','sv','tl','ty','tg','ta','tt','te','th','bo','ti','to','ts','tn','tr','tk',
  'tw','ug','uk','ur','uz','ve','vi','vo','wa','cy','wo','xh','yi','yo','za','zu'
]);

// Common ISO 3166-1 alpha-2 country codes
export const ISO_3166_1 = new Set([
  'ad','ae','af','ag','ai','al','am','ao','aq','ar','as','at','au','aw','ax','az','ba','bb','bd','be','bf','bg','bh','bi',
  'bj','bl','bm','bn','bo','bq','br','bs','bt','bv','bw','by','bz','ca','cc','cd','cf','cg','ch','ci','ck','cl','cm','cn',
  'co','cr','cu','cv','cw','cx','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','eh','er','es','et','fi','fj','fk',
  'fm','fo','fr','ga','gb','gd','ge','gf','gg','gh','gi','gl','gm','gn','gp','gq','gr','gs','gt','gu','gw','gy','hk','hm',
  'hn','hr','ht','hu','id','ie','il','im','in','io','iq','ir','is','it','je','jm','jo','jp','ke','kg','kh','ki','km','kn',
  'kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','me','mf','mg','mh','mk',
  'ml','mm','mn','mo','mp','mq','mr','ms','mt','mu','mv','mw','mx','my','mz','na','nc','ne','nf','ng','ni','nl','no','np',
  'nr','nu','nz','om','pa','pe','pf','pg','ph','pk','pl','pm','pn','pr','ps','pt','pw','py','qa','re','ro','rs','ru','rw',
  'sa','sb','sc','sd','se','sg','sh','si','sj','sk','sl','sm','sn','so','sr','ss','st','sv','sx','sy','sz','tc','td','tf',
  'tg','th','tj','tk','tl','tm','tn','to','tr','tt','tv','tw','tz','ua','ug','um','us','uy','uz','va','vc','ve','vg','vi',
  'vn','vu','wf','ws','ye','yt','za','zm','zw'
]);

/**
 * Validates a single hreflang tag value (e.g. "en-us", "x-default", "es", "zh-Hant")
 */
export function validateHreflangCode(code) {
  if (!code || typeof code !== 'string') return { valid: false, reason: 'Empty hreflang code' };
  const val = code.trim().toLowerCase();

  if (val === 'x-default') {
    return { valid: true, lang: 'x-default', region: null };
  }

  const parts = val.split('-');
  const lang = parts[0];
  const region = parts[1] || null;

  if (!ISO_639_1.has(lang)) {
    return { valid: false, lang, region, reason: `Invalid ISO 639-1 language code: "${lang}"` };
  }

  if (region && !ISO_3166_1.has(region) && !['hans', 'hant', 'latn', 'cyrl'].includes(region)) {
    return { valid: false, lang, region, reason: `Invalid ISO 3166-1 country code: "${region}"` };
  }

  return { valid: true, lang, region };
}

/**
 * Validates hreflang set on a page
 */
export function validatePageHreflangs(hreflangTags = [], currentUrl = '') {
  const issues = [];
  const validCodes = [];
  let hasXDefault = false;
  let hasSelfReference = false;
  const seenLangs = new Set();

  for (const tag of hreflangTags) {
    const langCode = tag.hreflang || tag.lang;
    const href = tag.href || '';
    const valResult = validateHreflangCode(langCode);

    if (!valResult.valid) {
      issues.push(`Invalid hreflang code "${langCode}": ${valResult.reason}`);
    } else {
      validCodes.push({ code: langCode, href });
      if (langCode.toLowerCase() === 'x-default') {
        hasXDefault = true;
      }
      if (seenLangs.has(langCode.toLowerCase())) {
        issues.push(`Duplicate hreflang tag for code "${langCode}"`);
      }
      seenLangs.add(langCode.toLowerCase());
    }

    if (currentUrl && href && normalizeUrl(href) === normalizeUrl(currentUrl)) {
      hasSelfReference = true;
    }
  }

  if (hreflangTags.length > 0) {
    if (!hasSelfReference && currentUrl) {
      issues.push('Missing self-referencing hreflang tag for current page URL');
    }
    if (!hasXDefault) {
      issues.push('Missing "x-default" hreflang fallback tag');
    }
  }

  return {
    valid: issues.length === 0,
    tagsCount: hreflangTags.length,
    hasSelfReference,
    hasXDefault,
    issues,
    validCodes
  };
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch (e) {
    return url.replace(/\/$/, '').toLowerCase();
  }
}
