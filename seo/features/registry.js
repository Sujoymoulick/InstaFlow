/**
 * Instaflow SEO Suite - Features Registry
 */

import { dashboardFeature } from './dashboard/index.js';
import { auditFeature } from './audit/index.js';
import { crawlerFeature } from './crawler/index.js';
import { toolboxFeature } from './toolbox/index.js';
import { keywordsFeature } from './keywords/index.js';
import { backlinksFeature } from './backlinks/index.js';
import { planningFeature } from './planning/index.js';
import { widgetFeature } from './widget/index.js';
import { reportsFeature } from './reports/index.js';
import { settingsFeature } from './settings/index.js';

export const ALL_FEATURES = [
  dashboardFeature,
  auditFeature,
  crawlerFeature,
  toolboxFeature,
  keywordsFeature,
  backlinksFeature,
  planningFeature,
  widgetFeature,
  reportsFeature,
  settingsFeature
];
