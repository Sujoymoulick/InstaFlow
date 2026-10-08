/**
 * Server-side Clients for ClickForNothing Production Integrations
 * Strictly loads environment credentials from .env and isolates connections.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { getEnv } from '../../../lib/env.js';

export interface SanitizedCfnClerkUser {
	id: string;
	name: string;
	firstName: string | null;
	lastName: string | null;
	username: string | null;
	email: string;
	emailAddresses: string[];
	imageUrl: string;
	createdAt: number;
	lastSignInAt: number | null;
	lastActiveAt: number | null;
	banned: boolean;
	locked: boolean;
	status: 'Active' | 'Banned' | 'Locked';
	twoFactorEnabled: boolean;
}

// ---------------------------------------------------------------------------
// 1. Neon PostgreSQL Client (ClickForNothing Dedicated DB)
// ---------------------------------------------------------------------------
let cachedCfnNeonSql: NeonQueryFunction<false, false> | null = null;

export function getCfnDatabaseUrl(): string {
	const url =
		getEnv('CLICKFORNOTHING_DATABASE_URL') ||
		getEnv('CLICKFORNOTHING_DATABASE_URL_UNPOOLED') ||
		getEnv('DATABASE_URL');
	return url.trim();
}

export function getCfnDatabaseUrlUnpooled(): string {
	const url =
		getEnv('CLICKFORNOTHING_DATABASE_URL_UNPOOLED') ||
		getEnv('CLICKFORNOTHING_DATABASE_URL') ||
		getEnv('DATABASE_URL_UNPOOLED') ||
		getEnv('DATABASE_URL');
	return url.trim();
}

export function isCfnDatabaseConfigured(): boolean {
	return Boolean(getCfnDatabaseUrl());
}

export function getCfnSql(): NeonQueryFunction<false, false> {
	if (cachedCfnNeonSql) return cachedCfnNeonSql;
	const connectionString = getCfnDatabaseUrl();
	if (!connectionString) {
		throw new Error('ClickForNothing Neon connection string is not configured (CLICKFORNOTHING_DATABASE_URL or DATABASE_URL).');
	}
	cachedCfnNeonSql = neon(connectionString);
	return cachedCfnNeonSql;
}

// ---------------------------------------------------------------------------
// 2. Clerk Authentication Client (ClickForNothing Instance)
// ---------------------------------------------------------------------------
export function getCfnClerkSecretKey(): string {
	return (
		getEnv('CLICKFORNOTHING_CLERK_SECRET_KEY') ||
		getEnv('CLERK_SECRET_KEY')
	);
}

export function getCfnClerkPublishableKey(): string {
	return (
		getEnv('CLICKFORNOTHING_CLERK_PUBLISHABLE_KEY') ||
		getEnv('PUBLIC_CLICKFORNOTHING_CLERK_PUBLISHABLE_KEY') ||
		getEnv('PUBLIC_CLERK_PUBLISHABLE_KEY') ||
		getEnv('CLERK_PUBLISHABLE_KEY')
	);
}

export function isCfnClerkConfigured(): boolean {
	return Boolean(getCfnClerkSecretKey());
}

export function sanitizeCfnClerkUser(user: any): SanitizedCfnClerkUser {
	if (!user) {
		throw new Error('Invalid Clerk user object');
	}

	const rawEmailAddresses = user.email_addresses || user.emailAddresses || [];
	const primaryEmailId = user.primary_email_address_id || user.primaryEmailAddressId;

	let primaryEmail = '';
	if (Array.isArray(rawEmailAddresses) && rawEmailAddresses.length > 0) {
		const matched = rawEmailAddresses.find((e: any) => e && (e.id === primaryEmailId || e._id === primaryEmailId));
		const emailObj = matched || rawEmailAddresses[0];
		primaryEmail = emailObj?.email_address || emailObj?.emailAddress || (typeof emailObj === 'string' ? emailObj : '') || '';
	}
	if (!primaryEmail && (user.primary_email_address || user.primaryEmailAddress)) {
		const pe = user.primary_email_address || user.primaryEmailAddress;
		primaryEmail = pe?.email_address || pe?.emailAddress || (typeof pe === 'string' ? pe : '') || '';
	}
	if (!primaryEmail && user.email) {
		primaryEmail = typeof user.email === 'string' ? user.email : '';
	}

	const firstName = (user.first_name || user.firstName || '').trim();
	const lastName = (user.last_name || user.lastName || '').trim();
	const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
	const username = (user.username || '').trim();
	const name = fullName || username || primaryEmail || 'ClickForNothing Creator';

	const emailAddresses: string[] = Array.isArray(rawEmailAddresses)
		? rawEmailAddresses
				.map((e: any) => e?.email_address || e?.emailAddress || (typeof e === 'string' ? e : ''))
				.filter(Boolean)
		: primaryEmail
		? [primaryEmail]
		: [];

	const banned = Boolean(user.banned);
	const locked = Boolean(user.locked);
	const status: 'Active' | 'Banned' | 'Locked' = banned ? 'Banned' : locked ? 'Locked' : 'Active';

	const rawCreatedAt = user.created_at ?? user.createdAt;
	const createdAt =
		typeof rawCreatedAt === 'number'
			? rawCreatedAt < 1e11
				? rawCreatedAt * 1000
				: rawCreatedAt
			: typeof rawCreatedAt === 'string'
			? new Date(rawCreatedAt).getTime()
			: Date.now();

	const rawLastSignInAt = user.last_sign_in_at ?? user.lastSignInAt;
	const lastSignInAt =
		typeof rawLastSignInAt === 'number'
			? rawLastSignInAt < 1e11
				? rawLastSignInAt * 1000
				: rawLastSignInAt
			: typeof rawLastSignInAt === 'string'
			? new Date(rawLastSignInAt).getTime()
			: null;

	const rawLastActiveAt = user.last_active_at ?? user.lastActiveAt;
	const lastActiveAt =
		typeof rawLastActiveAt === 'number'
			? rawLastActiveAt < 1e11
				? rawLastActiveAt * 1000
				: rawLastActiveAt
			: typeof rawLastActiveAt === 'string'
			? new Date(rawLastActiveAt).getTime()
			: null;

	const imageUrl = user.image_url || user.imageUrl || user.profile_image_url || user.profileImageUrl || '';

	return {
		id: user.id || '',
		name,
		firstName: firstName || null,
		lastName: lastName || null,
		username: username || null,
		email: primaryEmail,
		emailAddresses,
		imageUrl,
		createdAt,
		lastSignInAt,
		lastActiveAt,
		banned,
		locked,
		status,
		twoFactorEnabled: Boolean(user.two_factor_enabled || user.twoFactorEnabled),
	};
}

export async function fetchCfnClerkUsers(options: { page?: number; limit?: number; search?: string } = {}): Promise<{
	users: SanitizedCfnClerkUser[];
	total: number;
}> {
	const secretKey = getCfnClerkSecretKey();
	if (!secretKey) return { users: [], total: 0 };

	const limit = Math.min(100, Math.max(1, options.limit || 20));
	const offset = ((options.page || 1) - 1) * limit;

	const url = new URL('https://api.clerk.com/v1/users');
	url.searchParams.set('limit', String(limit));
	url.searchParams.set('offset', String(offset));
	url.searchParams.set('order_by', '-created_at');
	if (options.search?.trim()) {
		url.searchParams.set('query', options.search.trim());
	}

	try {
		const res = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${secretKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!res.ok) {
			console.error(`[ClickForNothing Clerk] Fetch returned HTTP ${res.status}`);
			return { users: [], total: 0 };
		}

		const data = await res.json();
		const sanitized = Array.isArray(data) ? data.map(sanitizeCfnClerkUser) : [];

		let total = sanitized.length;
		try {
			const countRes = await fetch('https://api.clerk.com/v1/users/count', {
				headers: { Authorization: `Bearer ${secretKey}` },
			});
			if (countRes.ok) {
				const countData = await countRes.json();
				total = countData.total_count || total;
			}
		} catch {}

		return { users: sanitized, total };
	} catch (err: any) {
		console.error('[ClickForNothing Clerk] API fetch error:', err.message);
		return { users: [], total: 0 };
	}
}

export async function fetchCfnClerkTotalUserCount(): Promise<number> {
	const secretKey = getCfnClerkSecretKey();
	if (!secretKey) return 0;
	try {
		const res = await fetch('https://api.clerk.com/v1/users/count', {
			headers: { Authorization: `Bearer ${secretKey}` },
		});
		if (res.ok) {
			const data = await res.json();
			return Number(data.total_count || 0);
		}
	} catch (e) {}
	return 0;
}

// ---------------------------------------------------------------------------
// 3. Cloudinary Storage Client
// ---------------------------------------------------------------------------
export function getCfnCloudinaryCredentials(): { cloudName: string; apiKey: string; apiSecret: string } {
	return {
		cloudName: getEnv('CLICKFORNOTHING_CLOUDINARY_CLOUD_NAME') || getEnv('CLOUDINARY_CLOUD_NAME'),
		apiKey: getEnv('CLICKFORNOTHING_CLOUDINARY_API_KEY') || getEnv('CLOUDINARY_API_KEY'),
		apiSecret: getEnv('CLICKFORNOTHING_CLOUDINARY_API_SECRET') || getEnv('CLOUDINARY_API_SECRET'),
	};
}

export function isCfnCloudinaryConfigured(): boolean {
	const { cloudName, apiKey, apiSecret } = getCfnCloudinaryCredentials();
	return Boolean(cloudName && apiKey && apiSecret);
}

// ---------------------------------------------------------------------------
// 4. Production Domain & Target Site
// ---------------------------------------------------------------------------
export function getCfnSiteUrl(): string {
	return getEnv('PUBLIC_CLICKFORNOTHING_SITE_URL') || getEnv('CLICKFORNOTHING_SITE_URL') || 'https://clickfornothing.com';
}
