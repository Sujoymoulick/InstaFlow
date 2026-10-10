/**
 * Instaflow SEO Suite - Usability & Mobile Accessibility Checks
 */

export const usabilityChecks = [
  {
    id: 'usability_viewport_meta',
    category: 'usability',
    scorecardGroup: 'usability',
    title: 'Mobile Responsive Viewport Meta',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const viewport = doc.querySelector('meta[name="viewport"]');
      if (!viewport) {
        return { status: 'fail', value: 'Missing', details: 'Missing <meta name="viewport"> tag. Mobile devices will render page in desktop mode.' };
      }
      const content = viewport.getAttribute('content') || '';
      if (!content.includes('width=device-width')) {
        return { status: 'warn', value: content, details: 'Viewport meta should contain "width=device-width, initial-scale=1.0".' };
      }
      return { status: 'pass', value: 'width=device-width', details: 'Responsive viewport meta tag correctly defined.' };
    },
    fixKey: 'checks.usability.viewport.fix',
    explainKey: 'checks.usability.viewport.explain'
  },
  {
    id: 'usability_touch_tap_targets',
    category: 'usability',
    scorecardGroup: 'usability',
    title: 'Interactive Tap Target Spacing Hints',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      // Check inline styles or font-size extremes
      const tinyButtons = doc.querySelectorAll('button[style*="font-size: 8px"], button[style*="font-size: 9px"], a[style*="font-size: 8px"]');
      if (tinyButtons.length > 0) {
        return { status: 'warn', value: `${tinyButtons.length} small elements`, details: 'Detected inline styles with sub-10px fonts on interactive elements that may hinder touch targets.' };
      }
      return { status: 'pass', value: 'Adequate sizing', details: 'Interactive controls and links appear properly proportioned for mobile interaction.' };
    },
    fixKey: 'checks.usability.touch_targets.fix',
    explainKey: 'checks.usability.touch_targets.explain'
  },
  {
    id: 'usability_interstitial_check',
    category: 'usability',
    scorecardGroup: 'usability',
    title: 'Intrusive Interstitial & Pop-up Risk',
    weight: 2,
    severity: 'low',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const modalOverlays = doc.querySelectorAll('[id*="popup"], [class*="modal-overlay"], [id*="interstitial"]');
      if (modalOverlays.length > 2) {
        return { status: 'warn', value: `${modalOverlays.length} modal elements`, details: 'Page contains modal pop-up structures. Ensure they do not block main content on mobile screens.' };
      }
      return { status: 'pass', value: 'No aggressive popups', details: 'No intrusive full-screen overlay markers detected in source structure.' };
    },
    fixKey: 'checks.usability.interstitial.fix',
    explainKey: 'checks.usability.interstitial.explain'
  }
];
