/**
 * Instaflow SEO Suite - Performance & Core Web Vitals Checks
 */

export const performanceChecks = [
  {
    id: 'perf_html_weight',
    category: 'performance',
    scorecardGroup: 'performance',
    title: 'HTML Document Size',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const bytes = ctx.rawHtml ? new TextEncoder().encode(ctx.rawHtml).length : (ctx.byteSize || 0);
      if (bytes === 0) return { status: 'na', value: 'N/A', details: 'HTML byte size unknown.' };
      const kb = Math.round(bytes / 1024);

      if (kb > 250) {
        return { status: 'fail', value: `${kb} KB`, details: `HTML payload is excessively heavy (${kb} KB > 250 KB). Excessive DOM size delays parsing.` };
      }
      if (kb > 100) {
        return { status: 'warn', value: `${kb} KB`, details: `HTML payload is moderately high (${kb} KB). Aim for under 100 KB uncompressed.` };
      }
      return { status: 'pass', value: `${kb} KB`, details: `HTML payload size is lean and fast (${kb} KB).` };
    },
    fixKey: 'checks.perf.html_weight.fix',
    explainKey: 'checks.perf.html_weight.explain'
  },
  {
    id: 'perf_render_blocking_scripts',
    category: 'performance',
    scorecardGroup: 'performance',
    title: 'Render-Blocking JavaScript Resources',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const headScripts = doc.querySelectorAll('head script[src]');
      const blocking = [];
      for (const s of headScripts) {
        const isAsync = s.hasAttribute('async');
        const isDefer = s.hasAttribute('defer');
        const isModule = s.getAttribute('type') === 'module';
        if (!isAsync && !isDefer && !isModule) {
          blocking.push(s.getAttribute('src'));
        }
      }
      if (blocking.length > 0) {
        return { status: 'warn', value: `${blocking.length} blocking`, details: `Found ${blocking.length} synchronous <script> tag(s) in <head> blocking initial render. Add "defer" or "async".` };
      }
      return { status: 'pass', value: '0 blocking scripts', details: 'All external head scripts use async, defer, or ES modules.' };
    },
    fixKey: 'checks.perf.render_blocking.fix',
    explainKey: 'checks.perf.render_blocking.explain'
  },
  {
    id: 'perf_image_formats_modern',
    category: 'performance',
    scorecardGroup: 'performance',
    title: 'Modern Image Formats (WebP / AVIF / SVG)',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const images = doc.querySelectorAll('img[src]');
      if (images.length === 0) return { status: 'pass', value: '0 images', details: 'No images.' };
      let legacyCount = 0;
      for (const img of images) {
        const src = (img.getAttribute('src') || '').toLowerCase();
        if (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
          legacyCount++;
        }
      }
      if (legacyCount > 0) {
        return { status: 'warn', value: `${legacyCount} legacy (PNG/JPG)`, details: `${legacyCount} image(s) use legacy PNG/JPEG format instead of modern next-gen formats like WebP or AVIF.` };
      }
      return { status: 'pass', value: 'Modern formats', details: 'Images are served using next-gen formats or vectors.' };
    },
    fixKey: 'checks.perf.modern_images.fix',
    explainKey: 'checks.perf.modern_images.explain'
  },
  {
    id: 'perf_preconnect_preload',
    category: 'performance',
    scorecardGroup: 'performance',
    title: 'Resource Preconnect & Preload Hints',
    weight: 2,
    severity: 'low',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const hints = doc.querySelectorAll('link[rel="preconnect"], link[rel="preload"], link[rel="dns-prefetch"]');
      if (hints.length === 0) {
        return { status: 'warn', value: '0 hints', details: 'No preconnect or preload resource hints configured for critical third-party fonts/origins.' };
      }
      return { status: 'pass', value: `${hints.length} hints`, details: `Found ${hints.length} resource hints optimizing connection and resource prioritization.` };
    },
    fixKey: 'checks.perf.preconnect.fix',
    explainKey: 'checks.perf.preconnect.explain'
  },
  {
    id: 'perf_pagespeed_vitals',
    category: 'performance',
    scorecardGroup: 'performance',
    title: 'Core Web Vitals (LCP, INP, CLS)',
    weight: 4,
    severity: 'critical',
    effort: 'high',
    tier: 2,
    test: (doc, ctx) => {
      if (!ctx.pageSpeed && !ctx.manualVitals) {
        return { status: 'na', value: 'No PSI Data', details: 'Run audit with Tier 2 PageSpeed Insights enabled or enter manual Core Web Vitals in Settings.' };
      }
      const vitals = ctx.pageSpeed || ctx.manualVitals;
      const lcp = vitals.lcp; // in seconds
      const cls = vitals.cls;
      const inp = vitals.inp;

      const fails = [];
      if (lcp && lcp > 2.5) fails.push(`LCP: ${lcp}s (>2.5s)`);
      if (cls && cls > 0.1) fails.push(`CLS: ${cls} (>0.1)`);
      if (inp && inp > 200) fails.push(`INP: ${inp}ms (>200ms)`);

      if (fails.length > 0) {
        return { status: 'fail', value: fails.join(', '), details: `Core Web Vitals fail Google thresholds: ${fails.join(', ')}.` };
      }
      return { status: 'pass', value: `LCP ${lcp || '<2.5'}s, CLS ${cls || '<0.1'}`, details: 'Core Web Vitals metrics pass Google performance standards.' };
    },
    fixKey: 'checks.perf.cwv.fix',
    explainKey: 'checks.perf.cwv.explain'
  }
];
