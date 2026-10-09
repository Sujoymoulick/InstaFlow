/**
 * Secure Server-side Clients for SendVirtualGift Integrations
 * Strictly isolates database credentials and secrets to server execution.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { createClient } from '@insforge/sdk';
import { getEnv } from '../../../lib/env.js';
import type { SanitizedClerkUser } from '../types.js';

// ---------------------------------------------------------------------------
// 1. Neon PostgreSQL Client
// ---------------------------------------------------------------------------
let cachedNeonSql: NeonQueryFunction<false, false> | null = null;

export function getNeonDatabaseUrl(): string {
	const url =
		getEnv('SENDVIRTUALGIFT_DATABASE_URL') ||
		getEnv('SENDVIRTUALGIFT_NEON_DATABASE_URL') ||
		getEnv('NEON_DATABASE_URL') ||
		getEnv('DATABASE_URL');
	return url.trim();
}

export function getNeonSql(): NeonQueryFunction<false, false> {
	if (cachedNeonSql) return cachedNeonSql;
	const connectionString = getNeonDatabaseUrl();
	if (!connectionString) {
		throw new Error('SendVirtualGift Neon database connection string is not configured (SENDVIRTUALGIFT_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL).');
	}
	cachedNeonSql = neon(connectionString);
	return cachedNeonSql;
}

export function isNeonConfigured(): boolean {
	return Boolean(getNeonDatabaseUrl());
}

// ---------------------------------------------------------------------------
// 2. InsForge BaaS Client
// ---------------------------------------------------------------------------
let cachedInsForgeClient: any = null;

export function getInsForgeConfig(): { baseUrl: string; anonKey: string } {
	const baseUrl =
		getEnv('PUBLIC_SENDVIRTUALGIFT_INSFORGE_URL') ||
		getEnv('SENDVIRTUALGIFT_INSFORGE_URL') ||
		getEnv('PUBLIC_INSFORGE_URL') ||
		getEnv('INSFORGE_URL') ||
		'https://at8vrkks.us-east.insforge.app';
	const anonKey =
		getEnv('PUBLIC_SENDVIRTUALGIFT_INSFORGE_ANON_KEY') ||
		getEnv('SENDVIRTUALGIFT_INSFORGE_ANON_KEY') ||
		getEnv('PUBLIC_INSFORGE_ANON_KEY') ||
		getEnv('INSFORGE_ANON_KEY');
	return { baseUrl, anonKey };
}

export function isInsForgeConfigured(): boolean {
	const { baseUrl, anonKey } = getInsForgeConfig();
	return Boolean(baseUrl && anonKey);
}

export function getInsForgeClient(): any {
	if (cachedInsForgeClient) return cachedInsForgeClient;
	const { baseUrl, anonKey } = getInsForgeConfig();
	if (!baseUrl || !anonKey) {
		throw new Error('InsForge configuration is incomplete (PUBLIC_SENDVIRTUALGIFT_INSFORGE_URL or PUBLIC_SENDVIRTUALGIFT_INSFORGE_ANON_KEY missing).');
	}
	cachedInsForgeClient = createClient({
		baseUrl,
		anonKey,
	});
	return cachedInsForgeClient;
}

export async function fetchNoSignupCounters(): Promise<{
	no_signup_cards: number;
	gift_views: number;
	initial_cards_offset: number;
	initial_views_offset: number;
	updated_at?: string;
}> {
	const defaultCounters = {
		no_signup_cards: 3158,
		gift_views: 3254,
		initial_cards_offset: 3158,
		initial_views_offset: 3254,
		updated_at: new Date().toISOString(),
	};

	if (!isInsForgeConfigured()) {
		return defaultCounters;
	}

	try {
		const insforge = getInsForgeClient();
		const { data, error } = await insforge.database
			.from('no_signup_counters')
			.select('*');

		if (error || !data || !Array.isArray(data)) {
			return defaultCounters;
		}

		let noSignupCards = defaultCounters.no_signup_cards;
		let giftViews = defaultCounters.gift_views;
		let initialCardsOffset = defaultCounters.initial_cards_offset;
		let initialViewsOffset = defaultCounters.initial_views_offset;
		let latestUpdated = defaultCounters.updated_at;

		for (const row of data) {
			const name = String(row.counter_name || '').trim();
			const count = Number(row.count) || 0;
			const offset = Number(row.initial_offset) || 0;

			if (name === 'no_signup_cards') {
				noSignupCards = Math.max(count, defaultCounters.no_signup_cards);
				if (offset > 0) initialCardsOffset = offset;
			} else if (name === 'gift_views') {
				giftViews = Math.max(count, defaultCounters.gift_views);
				if (offset > 0) initialViewsOffset = offset;
			}
			if (row.updated_at) {
				latestUpdated = row.updated_at;
			}
		}

		return {
			no_signup_cards: noSignupCards,
			gift_views: giftViews,
			initial_cards_offset: initialCardsOffset,
			initial_views_offset: initialViewsOffset,
			updated_at: latestUpdated,
		};
	} catch (e: any) {
		console.warn('Failed to fetch no_signup_counters from InsForge:', e.message);
		return defaultCounters;
	}
}

// ---------------------------------------------------------------------------
// 3. Clerk Authentication Client
// ---------------------------------------------------------------------------
export function getClerkSecretKey(): string {
	return (
		getEnv('SENDVIRTUALGIFT_CLERK_SECRET_KEY') ||
		getEnv('CLERK_SECRET_KEY')
	);
}

export function getClerkPublishableKey(): string {
	return (
		getEnv('PUBLIC_SENDVIRTUALGIFT_CLERK_PUBLISHABLE_KEY') ||
		getEnv('SENDVIRTUALGIFT_CLERK_PUBLISHABLE_KEY') ||
		getEnv('PUBLIC_CLERK_PUBLISHABLE_KEY') ||
		getEnv('CLERK_PUBLISHABLE_KEY')
	);
}

export function isClerkConfigured(): boolean {
	return Boolean(getClerkSecretKey());
}

export function sanitizeClerkUser(user: any): SanitizedClerkUser {
	if (!user) {
		throw new Error('Invalid Clerk user object');
	}

	// 1. Email Address Resolution (Supports snake_case Clerk REST API & camelCase SDK)
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

	// 2. Names & Username Resolution
	const firstName = (user.first_name || user.firstName || '').trim();
	const lastName = (user.last_name || user.lastName || '').trim();
	const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
	const username = (user.username || '').trim();
	const name = fullName || username || primaryEmail || 'SendVirtualGift User';

	// 3. Lists
	const emailAddresses: string[] = Array.isArray(rawEmailAddresses)
		? rawEmailAddresses
				.map((e: any) => e?.email_address || e?.emailAddress || (typeof e === 'string' ? e : ''))
				.filter(Boolean)
		: primaryEmail
		? [primaryEmail]
		: [];

	const rawPhoneNumbers = user.phone_numbers || user.phoneNumbers || [];
	const phoneNumbers: string[] = Array.isArray(rawPhoneNumbers)
		? rawPhoneNumbers
				.map((p: any) => p?.phone_number || p?.phoneNumber || (typeof p === 'string' ? p : ''))
				.filter(Boolean)
		: [];

	const rawExternalAccounts = user.external_accounts || user.externalAccounts || [];
	const externalAccounts = Array.isArray(rawExternalAccounts)
		? rawExternalAccounts.map((a: any) => ({
				provider: a?.provider || a?.verification?.strategy || 'oauth',
				emailAddress: a?.email_address || a?.emailAddress || '',
		  }))
		: [];

	// 4. Account Status & Timestamps
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
		phoneNumbers,
		externalAccounts,
	};
}

export async function fetchClerkUsers(options: { page?: number; limit?: number; search?: string } = {}): Promise<{
	users: SanitizedClerkUser[];
	total: number;
}> {
	const secretKey = getClerkSecretKey();
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
			console.error(`Clerk users fetch returned HTTP ${res.status}`);
			return { users: [], total: 0 };
		}

		const data = await res.json();
		const sanitized = Array.isArray(data) ? data.map(sanitizeClerkUser) : [];

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
		console.error('Clerk API fetch failed:', err.message);
		return { users: [], total: 0 };
	}
}

export async function fetchClerkTotalUserCount(): Promise<number> {
	const secretKey = getClerkSecretKey();
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
// 4. Razorpay Payments Client
// ---------------------------------------------------------------------------
export function getRazorpayCredentials(): { keyId: string; keySecret: string } {
	const keyId =
		getEnv('SENDVIRTUALGIFT_RAZORPAY_KEY_ID') ||
		getEnv('PUBLIC_SENDVIRTUALGIFT_RAZORPAY_KEY_ID') ||
		getEnv('RAZORPAY_KEY_ID') ||
		getEnv('PUBLIC_RAZORPAY_KEY_ID');
	const keySecret =
		getEnv('SENDVIRTUALGIFT_RAZORPAY_KEY_SECRET') ||
		getEnv('RAZORPAY_KEY_SECRET');
	return { keyId, keySecret };
}

export function isRazorpayConfigured(): boolean {
	const { keyId, keySecret } = getRazorpayCredentials();
	return Boolean(keyId && keySecret);
}

export async function fetchRazorpayPayments(limit = 20): Promise<any[]> {
	const { keyId, keySecret } = getRazorpayCredentials();
	if (!keyId || !keySecret) return [];

	const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
	try {
		const res = await fetch(`https://api.razorpay.com/v1/payments?count=${limit}`, {
			headers: {
				Authorization: `Basic ${auth}`,
			},
		});
		if (res.ok) {
			const data = await res.json();
			return data.items || [];
		}
	} catch (e: any) {
		console.error('Razorpay fetch payments failed:', e.message);
	}
	return [];
}

// ---------------------------------------------------------------------------
// 5. Cloudinary Storage Client
// ---------------------------------------------------------------------------
export function getCloudinaryCredentials(): { cloudName: string; apiKey: string; apiSecret: string } {
	return {
		cloudName:
			getEnv('SENDVIRTUALGIFT_CLOUDINARY_CLOUD_NAME') ||
			getEnv('CLOUDINARY_CLOUD_NAME'),
		apiKey:
			getEnv('SENDVIRTUALGIFT_CLOUDINARY_API_KEY') ||
			getEnv('CLOUDINARY_API_KEY'),
		apiSecret:
			getEnv('SENDVIRTUALGIFT_CLOUDINARY_API_SECRET') ||
			getEnv('CLOUDINARY_API_SECRET'),
	};
}

export function isCloudinaryConfigured(): boolean {
	const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
	return Boolean(cloudName && apiKey && apiSecret);
}
