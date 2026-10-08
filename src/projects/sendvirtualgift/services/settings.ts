/**
 * SendVirtualGift Configuration and Settings Service
 * Manages project settings, production target configuration, maintenance banner, and feature flags.
 */

export interface SvgProjectSettings {
	projectId: string;
	projectName: string;
	productionDomain: string;
	tier: string;
	environment: string;
	maintenanceMode: boolean;
	maintenanceMessage: string;
	featureFlags: {
		enablePaidRoseTemplate: boolean;
		enableTurnstileBotCheck: boolean;
		enableCloudinaryUploads: boolean;
		enableAnonymousCardCreation: boolean;
		enableRealtimeUpdates: boolean;
		enableWhatsappShare: boolean;
	};
	supportEmail: string;
	adminNotificationEmail: string;
	lastUpdated: string;
}

import { getEnv } from '../../../lib/env.js';

export function getSvgSettings(): SvgProjectSettings {
	return {
		projectId: 'sendvirtualgift',
		projectName: 'SendVirtualGift',
		productionDomain: getEnv('PUBLIC_SITE_URL', 'https://sendvirtualgift.com'),
		tier: 'Primary Production Micro-SaaS',
		environment: getEnv('NODE_ENV', 'production'),
		maintenanceMode: false,
		maintenanceMessage: 'SendVirtualGift is undergoing routine performance optimization. Service will resume shortly.',
		featureFlags: {
			enablePaidRoseTemplate: true,
			enableTurnstileBotCheck: Boolean(getEnv('PUBLIC_TURNSTILE_SITE_KEY')),
			enableCloudinaryUploads: Boolean(getEnv('CLOUDINARY_CLOUD_NAME')),
			enableAnonymousCardCreation: true,
			enableRealtimeUpdates: true,
			enableWhatsappShare: true,
		},
		supportEmail: getEnv('PUBLIC_SUPPORT_EMAIL', 'support@sendvirtualgift.com'),
		adminNotificationEmail: getEnv('ADMIN_EMAIL') || getEnv('ALLOWED_ADMIN_EMAIL') || 'lifeunderzero777@gmail.com',
		lastUpdated: new Date().toISOString(),
	};
}
