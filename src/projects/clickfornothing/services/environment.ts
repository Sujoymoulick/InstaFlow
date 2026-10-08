/**
 * ClickForNothing Environment Configuration Auditor
 * Evaluates configured, missing, and optional environment variables from .env.
 * SECURITY: NEVER exposes raw secrets; displays masked preview strings only.
 */

import { getEnv } from '../../../lib/env.js';

export interface CfnEnvVariableAuditItem {
	key: string;
	category: 'Database' | 'Auth' | 'Storage' | 'Site & URLs' | 'Security & Moderation';
	required: boolean;
	scope: 'Server-Only' | 'Client-Exposed';
	status: 'configured' | 'missing' | 'optional_not_set';
	maskedValue: string;
	description: string;
}

export interface CfnEnvAuditReport {
	items: CfnEnvVariableAuditItem[];
	summary: {
		total: number;
		configuredCount: number;
		missingRequiredCount: number;
		optionalCount: number;
	};
	deploymentNotice: string;
	lastUpdated: string;
}

export function auditCfnEnvironment(): CfnEnvAuditReport {
	const definitions: Array<{
		key: string;
		category: CfnEnvVariableAuditItem['category'];
		required: boolean;
		scope: CfnEnvVariableAuditItem['scope'];
		description: string;
	}> = [
		// Database
		{
			key: 'CLICKFORNOTHING_DATABASE_URL',
			category: 'Database',
			required: true,
			scope: 'Server-Only',
			description: 'Neon PostgreSQL pooled connection string for website submissions and reviews',
		},
		{
			key: 'CLICKFORNOTHING_DATABASE_URL_UNPOOLED',
			category: 'Database',
			required: false,
			scope: 'Server-Only',
			description: 'Neon PostgreSQL direct unpooled connection string for migrations and DDL',
		},
		{
			key: 'CLICKFORNOTHING_BRANCH',
			category: 'Database',
			required: false,
			scope: 'Server-Only',
			description: 'Active Neon database branch name (default: main)',
		},

		// Auth
		{
			key: 'CLICKFORNOTHING_CLERK_SECRET_KEY',
			category: 'Auth',
			required: true,
			scope: 'Server-Only',
			description: 'Clerk Production Backend API secret key for creator user accounts and roles',
		},
		{
			key: 'PUBLIC_CLICKFORNOTHING_CLERK_PUBLISHABLE_KEY',
			category: 'Auth',
			required: true,
			scope: 'Client-Exposed',
			description: 'Clerk frontend publishable key for user authentication components',
		},
		{
			key: 'CLICKFORNOTHING_ADMIN_EMAILS',
			category: 'Auth',
			required: false,
			scope: 'Server-Only',
			description: 'Authorized administrator email whitelist for ClickForNothing moderation',
		},

		// Storage
		{
			key: 'CLICKFORNOTHING_CLOUDINARY_CLOUD_NAME',
			category: 'Storage',
			required: true,
			scope: 'Server-Only',
			description: 'Cloudinary cloud name for site preview screenshots and icons',
		},
		{
			key: 'CLICKFORNOTHING_CLOUDINARY_API_KEY',
			category: 'Storage',
			required: true,
			scope: 'Server-Only',
			description: 'Cloudinary API access key identifier',
		},
		{
			key: 'CLICKFORNOTHING_CLOUDINARY_API_SECRET',
			category: 'Storage',
			required: true,
			scope: 'Server-Only',
			description: 'Cloudinary API secret for server-side image transformations and uploads',
		},

		// Site & URLs
		{
			key: 'PUBLIC_CLICKFORNOTHING_SITE_URL',
			category: 'Site & URLs',
			required: true,
			scope: 'Client-Exposed',
			description: 'Public production canonical URL (https://clickfornothing.com)',
		},

		// Security & Moderation
		{
			key: 'ENABLE_CLICKFORNOTHING_REALTIME_SYNC',
			category: 'Security & Moderation',
			required: false,
			scope: 'Server-Only',
			description: 'Enables background polling and real-time WebSocket sync across admin panels',
		},
		{
			key: 'CLICKFORNOTHING_RATE_LIMIT',
			category: 'Security & Moderation',
			required: false,
			scope: 'Server-Only',
			description: 'Max submission creation rate limit window per user/IP',
		},
	];

	function maskSecret(val: string): string {
		if (!val) return 'Not Configured';
		if (val.startsWith('postgresql://') || val.startsWith('postgres://')) {
			try {
				const url = new URL(val);
				return `${url.protocol}//${url.username}:••••••••@${url.host}${url.pathname}`;
			} catch {
				return 'postgresql://••••••••@ep-neon.tech/neondb';
			}
		}
		if (val.startsWith('pk_live_') || val.startsWith('pk_test_')) {
			return `${val.substring(0, 12)}••••••••${val.slice(-4)}`;
		}
		if (val.startsWith('sk_live_') || val.startsWith('sk_test_')) {
			return `${val.substring(0, 12)}••••••••${val.slice(-4)}`;
		}
		if (val.length <= 8) return '••••••••';
		return `${val.substring(0, 4)}••••••••${val.substring(val.length - 4)}`;
	}

	const items: CfnEnvVariableAuditItem[] = definitions.map((def) => {
		let val = getEnv(def.key);

		// Fallback checking for general variables if prefixed version is empty
		if (!val) {
			if (def.key === 'CLICKFORNOTHING_DATABASE_URL') val = getEnv('DATABASE_URL');
			if (def.key === 'CLICKFORNOTHING_DATABASE_URL_UNPOOLED') val = getEnv('DATABASE_URL_UNPOOLED');
			if (def.key === 'CLICKFORNOTHING_CLERK_SECRET_KEY') val = getEnv('CLERK_SECRET_KEY');
			if (def.key === 'PUBLIC_CLICKFORNOTHING_CLERK_PUBLISHABLE_KEY') val = getEnv('PUBLIC_CLERK_PUBLISHABLE_KEY');
			if (def.key === 'CLICKFORNOTHING_CLOUDINARY_CLOUD_NAME') val = getEnv('CLOUDINARY_CLOUD_NAME');
			if (def.key === 'CLICKFORNOTHING_CLOUDINARY_API_KEY') val = getEnv('CLOUDINARY_API_KEY');
			if (def.key === 'CLICKFORNOTHING_CLOUDINARY_API_SECRET') val = getEnv('CLOUDINARY_API_SECRET');
			if (def.key === 'CLICKFORNOTHING_ADMIN_EMAILS') val = getEnv('ADMIN_EMAILS') || getEnv('ALLOWED_ADMIN_EMAIL');
			if (def.key === 'PUBLIC_CLICKFORNOTHING_SITE_URL') val = getEnv('PUBLIC_SITE_URL');
		}

		let status: CfnEnvVariableAuditItem['status'] = 'configured';
		if (!val) {
			status = def.required ? 'missing' : 'optional_not_set';
		}

		return {
			key: def.key,
			category: def.category,
			required: def.required,
			scope: def.scope,
			status,
			maskedValue: val ? maskSecret(val) : 'Not Configured',
			description: def.description,
		};
	});

	const configuredCount = items.filter((i) => i.status === 'configured').length;
	const missingRequiredCount = items.filter((i) => i.status === 'missing').length;
	const optionalCount = items.filter((i) => i.status === 'optional_not_set').length;

	return {
		items,
		summary: {
			total: items.length,
			configuredCount,
			missingRequiredCount,
			optionalCount,
		},
		deploymentNotice:
			missingRequiredCount === 0
				? 'All essential production environment variables are fully configured from .env.'
				: `${missingRequiredCount} required environment variable(s) are currently missing.`,
		lastUpdated: new Date().toISOString(),
	};
}
