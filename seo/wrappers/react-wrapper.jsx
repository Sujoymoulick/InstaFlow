/**
 * Instaflow SEO Suite - React Wrapper Component
 *
 * Usage in React / Next.js:
 * import { SeoSuiteComponent } from './seo/wrappers/react-wrapper.jsx';
 *
 * export default function SeoPage() {
 *   return <SeoSuiteComponent proxyUrl="https://my-proxy.workers.dev" theme="light" locale="en" />;
 * }
 */

import React, { useEffect, useRef } from 'react';
import { mountSeoSuite } from '../index.js';

export function SeoSuiteComponent({ proxyUrl, crmAdapter, theme = 'light', locale = 'en', defaultFeature = 'dashboard', className = '' }) {
  const containerRef = useRef(null);
  const suiteInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    suiteInstanceRef.current = mountSeoSuite(containerRef.current, {
      proxyUrl,
      crmAdapter,
      theme,
      locale,
      defaultFeature
    });

    return () => {
      if (suiteInstanceRef.current && suiteInstanceRef.current.destroy) {
        suiteInstanceRef.current.destroy();
      }
    };
  }, [proxyUrl, theme, locale, defaultFeature]);

  return (
    <div ref={containerRef} className={`instaflow-seo-wrapper ${className}`} style={{ minHeight: '100vh', width: '100%' }} />
  );
}
