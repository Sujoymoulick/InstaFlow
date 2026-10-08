/**
 * SendVirtualGift Environment Configuration Auditor
 * Evaluates configured, missing, and optional environment variables.
 * SECURITY: NEVER exposes raw secret strings; displays masked preview strings only.
 */

import { getEnv } from '../../../lib/env.js';

export interface EnvVariableAuditItem {
	key: string;
	category: 'Database' | 'Auth' | 'Payments' | 'Storage' | 'Security & Rate Limits' | 'General';
	required: boolean;
	scope: 'Server-Only' | 'Client-Exposed';
	status: 'configured' | 'missing' | 'optional_not_set';
	maskedValue: string;
	description: string;
}

export interface EnvAuditReport {
	items: EnvVariableAuditItem[];
	summary: {
		total: number;
		configuredCount: number;
		missingRequiredCount: number;
		optionalCount: number;
	};
	deploymentNotice: string;
	lastUpdated: string;
}

export function auditSvgEnvironment(): EnvAuditReport {
	const definitions: Array<{
		key: string;
		category: EnvVariableAuditItem['category'];
		required: boolean;
		scope: EnvVariableAuditItem['scope'];
		description: string;
	}> = [
		// Database
		{
			key: 'NEON_DATABASE_URL',
			category: 'Database',
			required: true,
			scope: 'Server-Only',
			description: 'Primary Neon PostgreSQL connection string for paid orders & backups',
		},
		{
			key: 'PUBLIC_INSFORGE_URL',
			category: 'Database',
			required: true,
			scope: 'Client-Exposed',
			description: 'InsForge application BaaS API base URL',
		},
		{
			key: 'PUBLIC_INSFORGE_ANON_KEY',
			category: 'Database',
			required: true,
			scope: 'Client-Exposed',
			description: 'InsForge anonymous client public key for browser and server calls',
		},
		{
			key: 'NEON_BRANCH',
			category: 'Database',
			required: false,
			scope: 'Server-Only',
			description: 'Active Neon database branch name (default: main)',
		},

		// Auth
		{
			key: 'CLERK_SECRET_KEY',
			category: 'Auth',
			required: true,
			scope: 'Server-Only',
			description: 'Clerk Backend API secret key for authoritative user queries',
		},
		{
			key: 'PUBLIC_CLERK_PUBLISHABLE_KEY',
			category: 'Auth',
			required: true,
			scope: 'Client-Exposed',
			description: 'Clerk frontend publishable key for client sign-in components',
		},
		{
			key: 'ADMIN_EMAILS',
			category: 'Auth',
			required: false,
			scope: 'Server-Only',
			description: 'Comma-separated authorized administrator email whitelist',
		},

		// Payments
		{
			key: 'RAZORPAY_KEY_ID',
			category: 'Payments',
			required: true,
			scope: 'Server-Only',
			description: 'Razorpay API key identifier for INR payment orders',
		},
		{
			key: 'PUBLIC_RAZORPAY_KEY_ID',
			category: 'Payments',
			required: false,
			scope: 'Client-Exposed',
			description: 'Public Razorpay key for opening the checkout modal on web',
		},
		{
			key: 'RAZORPAY_KEY_SECRET',
			category: 'Payments',
			required: true,
			scope: 'Server-Only',
			description: 'Razorpay secret key for cryptographic signature verification',
		},
		{
			key: 'RAZORPAY_WEBHOOK_SECRET',
			category: 'Payments',
			required: false,
			scope: 'Server-Only',
			description: 'Secret for validating automated Razorpay webhooks',
		},

		// Storage
		{
			key: 'CLOUDINARY_CLOUD_NAME',
			category: 'Storage',
			required: true,
			scope: 'Client-Exposed',
			description: 'Cloudinary cloud name for media asset uploads',
		},
		{
			key: 'CLOUDINARY_API_KEY',
			category: 'Storage',
			required: true,
			scope: 'Server-Only',
			description: 'Cloudinary API key for server upload signatures',
		},
		{
			key: 'CLOUDINARY_API_SECRET',
			category: 'Storage',
			required: true,
			scope: 'Server-Only',
			description: 'Cloudinary API secret for server authentication',
		},
		{
			key: 'MAX_IMAGE_SIZE_MB',
			category: 'Storage',
			required: false,
			scope: 'Server-Only',
			description: 'Maximum image upload size limit in Megabytes',
		},

		// Security & Rate Limits
		{
			key: 'ENABLE_RATE_LIMITING',
			category: 'Security & Rate Limits',
			required: false,
			scope: 'Server-Only',
			description: 'Global master switch to enforce rate limits on endpoints',
		},
		{
			key: 'ENABLE_SECURITY_LOGGING',
			category: 'Security & Rate Limits',
			required: false,
			scope: 'Server-Only',
			description: 'Audit log flag for security events and blocked requests',
		},
		{
			key: 'PUBLIC_TURNSTILE_SITE_KEY',
			category: 'Security & Rate Limits',
			required: false,
			scope: 'Client-Exposed',
			description: 'Cloudflare Turnstile bot protection site key',
		},
		{
			key: 'TURNSTILE_SECRET_KEY',
			category: 'Security & Rate Limits',
			required: false,
			scope: 'Server-Only',
			description: 'Cloudflare Turnstile secret key for server-side token validation',
		},

		// General
		{
			key: 'PUBLIC_SITE_URL',
			category: 'General',
			required: false,
			scope: 'Client-Exposed',
			description: 'Target production domain (https://sendvirtualgift.com)',
		},
		{
			key: 'PUBLIC_SUPPORT_EMAIL',
			category: 'General',
			required: false,
			scope: 'Client-Exposed',
			description: 'Contact support email address for user receipts & help',
		},
	];

	let configuredCount = 0;
	let missingRequiredCount = 0;
	let optionalCount = 0;

	const items: EnvVariableAuditItem[] = definitions.map((def) => {
		let rawVal = getEnv(`SENDVIRTUALGIFT_${def.key}`) || getEnv(def.key);
		if (!rawVal && def.key.startsWith('PUBLIC_')) {
			rawVal = getEnv(`PUBLIC_SENDVIRTUALGIFT_${def.key.replace('PUBLIC_', '')}`);
		}
		if (!rawVal && def.key === 'NEON_DATABASE_URL') {
			rawVal = getEnv('SENDVIRTUALGIFT_DATABASE_URL') || getEnv('DATABASE_URL');
		}
		if (!rawVal && def.key === 'CLERK_SECRET_KEY') {
			rawVal = getEnv('SENDVIRTUALGIFT_CLERK_SECRET_KEY');
		}
		if (!rawVal && def.key === 'PUBLIC_CLERK_PUBLISHABLE_KEY') {
			rawVal = getEnv('PUBLIC_SENDVIRTUALGIFT_CLERK_PUBLISHABLE_KEY') || getEnv('SENDVIRTUALGIFT_CLERK_PUBLISHABLE_KEY');
		}

		const exists = rawVal.length > 0;

		let status: EnvVariableAuditItem['status'] = 'missing';
		let maskedValue = '—';

		if (exists) {
			status = 'configured';
			configuredCount++;
			maskedValue = maskSecretValue(def.key, rawVal.trim());
		} else if (def.required) {
			status = 'missing';
			missingRequiredCount++;
			maskedValue = 'Missing Required';
		} else {
			status = 'optional_not_set';
			optionalCount++;
			maskedValue = 'Not set (Optional)';
		}

		return {
			key: def.key,
			category: def.category,
			required: def.required,
			scope: def.scope,
			status,
			maskedValue,
			description: def.description,
		};
	});

	return {
		items,
		summary: {
			total: definitions.length,
			configuredCount,
			missingRequiredCount,
			optionalCount,
		},
		deploymentNotice:
			'Local environment variables (.env) are active for this server session. Ensure identical variable names are configured in your Vercel or Cloudflare production dashboard.',
		lastUpdated: new Date().toISOString(),
	};
}

function maskSecretValue(key: string, val: string): string {
	if (key.includes('URL') || key.includes('DOMAIN') || key.includes('EMAIL') || key.includes('NAME') || key.includes('SIZE') || key.includes('ENABLE')) {
		if (val.startsWith('http')) {
			try {
				const u = new URL(val);
				return `${u.protocol}//${u.host}`;
			} catch {}
		}
		if (val.length > 25) {
			return `${val.substring(0, 8)}...${val.substring(val.length - 6)}`;
		}
		return val;
	}

	// Secret tokens / keys: mask most characters
	if (val.length <= 8) return '********';
	return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
}
