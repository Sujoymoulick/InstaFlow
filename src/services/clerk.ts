import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { decryptToken, encryptToken } from '../lib/crypto.js';
import type { ClerkApp, NewClerkApp } from '../db/schema.js';

export interface ClerkUser {
	id: string;
	object: string;
	projectName?: string;
	projectSlug?: string;
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

export interface ClerkMetrics {
	totalUsers: number;
	activeUsers7d: number;
	oauthUsers: number;
	verifiedEmails: number;
	bannedUsers: number;
	totalProjects: number;
}

// Known projects configured across your workspace .env files
const KNOWN_CLERK_PROJECTS = [
	{
		id: 'clerk-virtual-gift',
		name: 'SEND VIRTUAL GIFT',
		publishableKey: 'pk_test_Z3VpZGVkLWR1Y2tsaW5nLTQyNjYuY2xlcmsuYWNjb3VudHMuZGV2JA',
		secretKey: 'sk_test_pKMjJGW5osGrNNUw7Wa2tpm3E1AJHsqebHVeHbEQkp',
		instanceUrl: 'https://guided-duckling-4266.clerk.accounts.dev',
		projectSlug: 'virtualgiftsite',
		isDefault: true,
	},
	{
		id: 'clerk-freepdfly',
		name: 'FreePDFLY (PDF Tool)',
		publishableKey: 'pk_test_cmVsYXhpbmctY2FyZGluYWwtNDEyNi5jbGVyay5hY2NvdW50cy5kZXYk',
		secretKey: 'sk_test_GzPtfgLGPBVqczR8Pndfzpz99yHjBxTga0WQ09IBXJ',
		instanceUrl: 'https://relaxing-cardinal-4126.clerk.accounts.dev',
		projectSlug: 'freepdfly',
		isDefault: false,
	},
	{
		id: 'clerk-combine-saas',
		name: 'Combine SaaS',
		publishableKey: 'pk_test_am9pbnQtaG91bmQtNjMzMS5jbGVyay5hY2NvdW50cy5kZXYk',
		secretKey: 'sk_test_MLi1UKDMvNwUC4oWeGY3soVVczcFcg5BnspOwsWstr',
		instanceUrl: 'https://joint-hound-6331.clerk.accounts.dev',
		projectSlug: 'combine-saas',
		isDefault: false,
	},
];

/**
 * Get all configured Clerk applications from the database + environment + defaults
 */
export async function getClerkApps(): Promise<
	Array<{
		id: string;
		name: string;
		publishableKey: string;
		instanceUrl: string | null;
		projectSlug: string | null;
		isDefault: boolean;
		secretKey: string;
		createdAt: Date;
		updatedAt: Date;
	}>
> {
	const db = getDb();
	const apps: Array<{
		id: string;
		name: string;
		publishableKey: string;
		instanceUrl: string | null;
		projectSlug: string | null;
		isDefault: boolean;
		secretKey: string;
		createdAt: Date;
		updatedAt: Date;
	}> = [];

	// Check if local .env has a direct CLERK_SECRET_KEY
	if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY.startsWith('sk_')) {
		apps.push({
			id: 'clerk-env-main',
			name: process.env.CLERK_PROJECT_NAME || 'Primary Clerk Project',
			publishableKey: process.env.PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || '',
			instanceUrl: process.env.CLERK_INSTANCE_URL || null,
			projectSlug: 'primary',
			isDefault: true,
			secretKey: process.env.CLERK_SECRET_KEY,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

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
				if (!apps.some((x) => x.id === a.id || (x.publishableKey && x.publishableKey === a.publishableKey))) {
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
			}
		} catch (err) {
			console.error('[Clerk Service] Error fetching apps from DB:', err);
		}
	}

	// Merge known projects if not already added
	for (const known of KNOWN_CLERK_PROJECTS) {
		if (!apps.some((a) => a.publishableKey === known.publishableKey || a.name.toLowerCase() === known.name.toLowerCase())) {
			apps.push({
				id: known.id,
				name: known.name,
				publishableKey: known.publishableKey,
				instanceUrl: known.instanceUrl,
				projectSlug: known.projectSlug,
				isDefault: known.isDefault && apps.length === 0,
				secretKey: known.secretKey,
				createdAt: new Date('2026-09-30'),
				updatedAt: new Date(),
			});
		}
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
 * Fetch single app users from Clerk API
 */
async function fetchSingleAppUsers(app: { name: string; projectSlug: string | null; secretKey: string }, query?: string): Promise<{ users: ClerkUser[]; totalCount: number }> {
	const key = app.secretKey.trim();
	if (!key || !key.startsWith('sk_')) {
		return { users: [], totalCount: 0 };
	}

	const headers = {
		Authorization: `Bearer ${key}`,
		'Content-Type': 'application/json',
	};

	const queryParam = query ? `&query=${encodeURIComponent(query)}` : '';
	const usersUrl = `https://api.clerk.com/v1/users?limit=100&order_by=-created_at${queryParam}`;

	let totalCount = 0;
	try {
		const countRes = await fetch('https://api.clerk.com/v1/users/count', { headers });
		if (countRes.ok) {
			const countData = await countRes.json();
			totalCount = countData.total_count || 0;
		}
	} catch {}

	const usersRes = await fetch(usersUrl, { headers });
	if (!usersRes.ok) {
		const errText = await usersRes.text();
		throw new Error(`Clerk API request failed for ${app.name} (${usersRes.status}): ${errText}`);
	}

	const rawUsers = (await usersRes.json()) as any[];
	const users: ClerkUser[] = rawUsers.map((u) => {
		const primaryEmailObj = u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id) || u.email_addresses?.[0];
		const primaryEmail = primaryEmailObj?.email_address || null;
		const primaryEmailVerified = primaryEmailObj?.verification?.status === 'verified';

		return {
			id: u.id,
			object: u.object || 'user',
			projectName: app.name,
			projectSlug: app.projectSlug || undefined,
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

	if (totalCount === 0 && users.length > 0) {
		totalCount = users.length;
	}

	return { users, totalCount };
}

/**
 * Fetch users and counts across a single app or all configured Clerk apps
 */
export async function fetchClerkData(appOrKey: string | { id: string; name: string; secretKey: string; projectSlug?: string | null }, options?: { query?: string; fetchAll?: boolean }) {
	let appsToFetch: Array<{ name: string; projectSlug: string | null; secretKey: string }> = [];

	if (options?.fetchAll) {
		const allApps = await getClerkApps();
		appsToFetch = allApps.filter((a) => a.secretKey && a.secretKey.startsWith('sk_'));
	} else if (typeof appOrKey === 'string') {
		appsToFetch = [{ name: 'Clerk App', projectSlug: null, secretKey: appOrKey }];
	} else {
		appsToFetch = [{ name: appOrKey.name, projectSlug: appOrKey.projectSlug || null, secretKey: appOrKey.secretKey }];
	}

	if (appsToFetch.length === 0) {
		throw new Error('No valid Clerk applications to fetch');
	}

	const results = await Promise.allSettled(appsToFetch.map((a) => fetchSingleAppUsers(a, options?.query)));

	const allUsers: ClerkUser[] = [];
	let totalCount = 0;

	for (const res of results) {
		if (res.status === 'fulfilled') {
			allUsers.push(...res.value.users);
			totalCount += res.value.totalCount;
		} else {
			console.warn('[Clerk Service] Error fetching app users:', res.reason);
		}
	}

	// Sort users newest first
	allUsers.sort((a, b) => b.createdAt - a.createdAt);

	const now = Date.now();
	const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
	const activeUsers7d = allUsers.filter((u) => u.lastActiveAt && now - u.lastActiveAt <= sevenDaysMs).length;
	const oauthUsers = allUsers.filter((u) => u.externalAccounts.length > 0).length;
	const verifiedEmails = allUsers.filter((u) => u.primaryEmailVerified).length;
	const bannedUsers = allUsers.filter((u) => u.banned || u.locked).length;

	const metrics: ClerkMetrics = {
		totalUsers: totalCount,
		activeUsers7d,
		oauthUsers,
		verifiedEmails,
		bannedUsers,
		totalProjects: appsToFetch.length,
	};

	return {
		users: allUsers,
		totalCount,
		metrics,
	};
}
