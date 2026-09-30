import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { decryptToken, encryptToken } from '../lib/crypto.js';
import type { ClerkApp, NewClerkApp } from '../db/schema.js';

export interface ClerkUser {
	id: string;
	object: string;
	username: string | null;
	firstName: string | null;
	lastName: string | null;
	imageUrl: string | null;
	hasImage: boolean;
	primaryEmail: string | null;
	primaryEmailVerified: boolean;
	emailAddresses: Array<{
		id: string;
		email: string;
		verified: boolean;
		strategy?: string;
	}>;
	phoneNumbers: Array<{
		id: string;
		number: string;
		verified: boolean;
	}>;
	externalAccounts: Array<{
		id: string;
		provider: string;
		emailAddress: string;
		avatarUrl?: string;
	}>;
	banned: boolean;
	locked: boolean;
	createdAt: number;
	updatedAt: number;
	lastSignInAt: number | null;
	lastActiveAt: number | null;
	rawMetadata: {
		public: Record<string, any>;
		unsafe: Record<string, any>;
	};
}

export interface ClerkAppSummary {
	id: string;
	name: string;
	publishableKey: string;
	instanceUrl?: string | null;
	projectSlug?: string | null;
	isDefault: boolean;
	userCount: number;
	isConfigured: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ClerkMetrics {
	totalUsers: number;
	activeUsers7d: number;
	oauthUsers: number;
	verifiedEmails: number;
	bannedUsers: number;
}

// Built-in default app fallback
const DEFAULT_VIRTUAL_GIFT_APP = {
	id: 'builtin-virtual-gift',
	name: 'SEND VIRTUAL GIFT',
	publishableKey: 'pk_test_Z3VpZGVkLWR1Y2tsaW5nLTQyNjYuY2xlcmsuYWNjb3VudHMuZGV2JA',
	secretKey: 'sk_test_pKMjJGW5osGrNNUw7Wa2tpm3E1AJHsqebHVeHbEQkp',
	instanceUrl: 'https://guided-duckling-4266.clerk.accounts.dev',
	projectSlug: 'virtualgiftsite',
	isDefault: true,
};

/**
 * Get all configured Clerk applications from the database or defaults
 */
export async function getClerkApps(): Promise<Array<{ id: string; name: string; publishableKey: string; instanceUrl: string | null; projectSlug: string | null; isDefault: boolean; secretKey: string; createdAt: Date; updatedAt: Date }>> {
	const db = getDb();
	const apps: Array<{ id: string; name: string; publishableKey: string; instanceUrl: string | null; projectSlug: string | null; isDefault: boolean; secretKey: string; createdAt: Date; updatedAt: Date }> = [];

	if (db) {
		try {
			const dbApps = await db.select().from(schema.clerkApps).orderBy(desc(schema.clerkApps.createdAt));
			for (const a of dbApps) {
				let secret = '';
				try {
					secret = decryptToken(a.secretKeyEncrypted);
				} catch {
					secret = '';
				}
				apps.push({
					id: a.id,
					name: a.name,
					publishableKey: a.publishableKey,
					instanceUrl: a.instanceUrl,
					projectSlug: a.projectSlug,
					isDefault: a.isDefault,
					secretKey: secret,
					createdAt: a.createdAt,
					updatedAt: a.updatedAt,
				});
			}
		} catch (err) {
			console.error('[Clerk Service] Error fetching apps from DB:', err);
		}
	}

	// If no apps in database or SEND VIRTUAL GIFT not yet added, ensure default exists
	const hasVirtualGift = apps.some((a) => a.name.toLowerCase().includes('virtual gift') || a.publishableKey === DEFAULT_VIRTUAL_GIFT_APP.publishableKey);
	if (!hasVirtualGift) {
		apps.unshift({
			id: DEFAULT_VIRTUAL_GIFT_APP.id,
			name: DEFAULT_VIRTUAL_GIFT_APP.name,
			publishableKey: DEFAULT_VIRTUAL_GIFT_APP.publishableKey,
			instanceUrl: DEFAULT_VIRTUAL_GIFT_APP.instanceUrl,
			projectSlug: DEFAULT_VIRTUAL_GIFT_APP.projectSlug,
			isDefault: true,
			secretKey: DEFAULT_VIRTUAL_GIFT_APP.secretKey,
			createdAt: new Date('2026-09-30'),
			updatedAt: new Date(),
		});
	}

	return apps;
}

/**
 * Add a new Clerk app configuration
 */
export async function addClerkApp(data: {
	name: string;
	publishableKey: string;
	secretKey: string;
	instanceUrl?: string;
	projectSlug?: string;
	isDefault?: boolean;
}) {
	const db = getDb();
	if (!db) throw new Error('Database is not connected');

	const encrypted = encryptToken(data.secretKey.trim());
	const [inserted] = await db
		.insert(schema.clerkApps)
		.values({
			name: data.name.trim(),
			publishableKey: data.publishableKey.trim(),
			secretKeyEncrypted: encrypted,
			instanceUrl: data.instanceUrl?.trim() || null,
			projectSlug: data.projectSlug?.trim() || null,
			isDefault: Boolean(data.isDefault),
		})
		.returning();

	return inserted;
}

/**
 * Delete a Clerk app configuration
 */
export async function deleteClerkApp(id: string) {
	const db = getDb();
	if (!db) throw new Error('Database is not connected');

	await db.delete(schema.clerkApps).where(eq(schema.clerkApps.id, id));
	return { success: true };
}

/**
 * Fetch users and counts directly from Clerk Backend REST API
 */
export async function fetchClerkData(secretKey: string, options?: { limit?: number; offset?: number; query?: string }) {
	const key = secretKey.trim();
	if (!key || !key.startsWith('sk_')) {
		throw new Error('Valid Clerk Secret Key (starting with sk_...) is required');
	}

	const headers = {
		Authorization: `Bearer ${key}`,
		'Content-Type': 'application/json',
	};

	const limit = options?.limit || 100;
	const offset = options?.offset || 0;
	const queryParam = options?.query ? `&query=${encodeURIComponent(options.query)}` : '';

	// 1. Fetch user count
	let totalCount = 0;
	try {
		const countRes = await fetch('https://api.clerk.com/v1/users/count', { headers });
		if (countRes.ok) {
			const countData = await countRes.json();
			totalCount = countData.total_count || 0;
		}
	} catch (e) {
		console.warn('[Clerk API] Count fetch failed:', e);
	}

	// 2. Fetch users list
	const usersUrl = `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}&order_by=-created_at${queryParam}`;
	const usersRes = await fetch(usersUrl, { headers });

	if (!usersRes.ok) {
		const errText = await usersRes.text();
		throw new Error(`Clerk API request failed (${usersRes.status}): ${errText}`);
	}

	const rawUsers = (await usersRes.json()) as any[];
	const users: ClerkUser[] = rawUsers.map((u) => {
		const primaryEmailObj = u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id) || u.email_addresses?.[0];
		const primaryEmail = primaryEmailObj?.email_address || null;
		const primaryEmailVerified = primaryEmailObj?.verification?.status === 'verified';

		return {
			id: u.id,
			object: u.object || 'user',
			username: u.username || null,
			firstName: u.first_name || null,
			lastName: u.last_name || null,
			imageUrl: u.image_url || u.profile_image_url || null,
			hasImage: Boolean(u.has_image || u.image_url || u.profile_image_url),
			primaryEmail,
			primaryEmailVerified,
			emailAddresses: (u.email_addresses || []).map((e: any) => ({
				id: e.id,
				email: e.email_address,
				verified: e.verification?.status === 'verified',
				strategy: e.verification?.strategy,
			})),
			phoneNumbers: (u.phone_numbers || []).map((p: any) => ({
				id: p.id,
				number: p.phone_number,
				verified: p.verification?.status === 'verified',
			})),
			externalAccounts: (u.external_accounts || []).map((ea: any) => ({
				id: ea.id,
				provider: ea.provider?.replace('oauth_', '') || 'oauth',
				emailAddress: ea.email_address,
				avatarUrl: ea.avatar_url || ea.image_url,
			})),
			banned: Boolean(u.banned),
			locked: Boolean(u.locked),
			createdAt: u.created_at,
			updatedAt: u.updated_at,
			lastSignInAt: u.last_sign_in_at || null,
			lastActiveAt: u.last_active_at || null,
			rawMetadata: {
				public: u.public_metadata || {},
				unsafe: u.unsafe_metadata || {},
			},
		};
	});

	// If count was 0 or not returned, calculate from users length
	if (totalCount === 0 && users.length > 0) {
		totalCount = users.length;
	}

	// Calculate metrics
	const now = Date.now();
	const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
	const activeUsers7d = users.filter((u) => u.lastActiveAt && now - u.lastActiveAt <= sevenDaysMs).length;
	const oauthUsers = users.filter((u) => u.externalAccounts.length > 0).length;
	const verifiedEmails = users.filter((u) => u.primaryEmailVerified).length;
	const bannedUsers = users.filter((u) => u.banned || u.locked).length;

	const metrics: ClerkMetrics = {
		totalUsers: totalCount,
		activeUsers7d,
		oauthUsers,
		verifiedEmails,
		bannedUsers,
	};

	return {
		users,
		totalCount,
		metrics,
	};
}
