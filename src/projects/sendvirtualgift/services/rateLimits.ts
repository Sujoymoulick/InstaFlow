/**
 * SendVirtualGift Rate Limiting and Quota Service
 * Inspects authoritative rate limit policies, configured limits, windows, and security logging.
 */

import { getEnv } from '../../../lib/env.js';
import type { RateLimitSettingItem } from '../types.js';

export interface SvgRateLimitOverview {
	enabled: boolean;
	securityLoggingEnabled: boolean;
	maxCardsPerUser: number;
	maxImagesPerUser: number;
	rules: RateLimitSettingItem[];
	lastUpdated: string;
}

export function getSvgRateLimits(): SvgRateLimitOverview {
	const enabled = getEnv('ENABLE_RATE_LIMITING', 'true') !== 'false';
	const securityLoggingEnabled = getEnv('ENABLE_SECURITY_LOGGING', 'true') !== 'false';

	const maxCardsPerUser = Number(getEnv('MAX_CARDS_PER_USER')) || 5;
	const maxImagesPerUser = Number(getEnv('MAX_IMAGES_PER_USER')) || 5;

	const rules: RateLimitSettingItem[] = [
		{
			key: 'image_upload',
			name: 'Image Upload Limit',
			description: 'Restricts frequency of Cloudinary image uploads per user/IP',
			limit: Number(getEnv('IMAGE_UPLOAD_RATE_LIMIT')) || 5,
			windowSeconds: Number(getEnv('IMAGE_UPLOAD_RATE_WINDOW_SECONDS')) || 60,
			unit: 'uploads',
			enabled,
		},
		{
			key: 'card_create',
			name: 'Card Creation Limit',
			description: 'Prevents automated spam generation of interactive cards',
			limit: Number(getEnv('CARD_CREATE_RATE_LIMIT')) || 5,
			windowSeconds: Number(getEnv('CARD_CREATE_RATE_WINDOW_SECONDS')) || 60,
			unit: 'creations',
			enabled,
		},
		{
			key: 'card_mutation',
			name: 'Card Mutation Limit',
			description: 'Rate limits edits, recipient updates, and message modifications',
			limit: Number(getEnv('CARD_MUTATION_RATE_LIMIT')) || 20,
			windowSeconds: Number(getEnv('CARD_MUTATION_RATE_WINDOW_SECONDS')) || 60,
			unit: 'mutations',
			enabled,
		},
		{
			key: 'card_share',
			name: 'Share Action Limit',
			description: 'Controls WhatsApp, Instagram, and web sharing token generation',
			limit: Number(getEnv('SHARE_RATE_LIMIT')) || 30,
			windowSeconds: Number(getEnv('SHARE_RATE_WINDOW_SECONDS')) || 60,
			unit: 'shares',
			enabled,
		},
		{
			key: 'api_general',
			name: 'General API Request Limit',
			description: 'Global gateway rate limiter for anonymous and authenticated API routes',
			limit: Number(getEnv('API_RATE_LIMIT')) || 100,
			windowSeconds: Number(getEnv('API_RATE_WINDOW_SECONDS')) || 60,
			unit: 'requests',
			enabled,
		},
	];

	return {
		enabled,
		securityLoggingEnabled,
		maxCardsPerUser,
		maxImagesPerUser,
		rules,
		lastUpdated: new Date().toISOString(),
	};
}
