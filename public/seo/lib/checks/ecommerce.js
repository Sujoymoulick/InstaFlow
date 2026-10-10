/**
 * Instaflow SEO Suite - E-Commerce SEO & Merchant Listing Checks
 */

import { extractJsonLd } from '../seo/schema.js';

export const ecommerceChecks = [
  {
    id: 'ecom_product_schema',
    category: 'ecommerce',
    scorecardGroup: 'onpage',
    title: 'Product Schema & Merchant Rich Data',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      const product = items.find(it => it['@type'] === 'Product');
      if (!product) {
        return { status: 'na', value: 'Non-Product page', details: 'No Product schema markup detected on this page.' };
      }
      const issues = [];
      if (!product.name) issues.push('missing name');
      if (!product.offers) issues.push('missing offers/pricing');
      if (!product.image) issues.push('missing product image');
      if (!product.aggregateRating && !product.review) issues.push('no reviews/ratings');

      if (issues.length > 0) {
        return { status: 'warn', value: `Incomplete (${issues.join(', ')})`, details: `Product schema is missing key merchant fields: ${issues.join(', ')}.` };
      }
      return { status: 'pass', value: `Product: "${(product.name || '').slice(0, 30)}"`, details: 'Product schema contains name, offers, image, and merchant pricing data.' };
    },
    fixKey: 'checks.ecom.product.fix',
    explainKey: 'checks.ecom.product.explain'
  },
  {
    id: 'ecom_offer_availability',
    category: 'ecommerce',
    scorecardGroup: 'onpage',
    title: 'Offer Price & Stock Availability Markup',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      const product = items.find(it => it['@type'] === 'Product');
      if (!product || !product.offers) return { status: 'na', value: 'N/A', details: 'No product offers detected.' };

      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const hasPrice = offer.price !== undefined || offer.lowPrice !== undefined;
      const hasCurrency = Boolean(offer.priceCurrency);
      const hasAvailability = Boolean(offer.availability);

      if (!hasPrice || !hasCurrency || !hasAvailability) {
        return { status: 'warn', value: 'Incomplete offer', details: 'Offer schema is missing price, currency, or InStock/OutOfStock availability.' };
      }
      return { status: 'pass', value: `${offer.priceCurrency || '$'}${offer.price} (${offer.availability.split('/').pop()})`, details: 'Valid offer price, currency, and availability schema configured.' };
    },
    fixKey: 'checks.ecom.offer.fix',
    explainKey: 'checks.ecom.offer.explain'
  }
];
