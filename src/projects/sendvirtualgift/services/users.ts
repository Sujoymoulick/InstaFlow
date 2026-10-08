/**
 * SendVirtualGift Admin Users Management Service
 * Merges authoritative Clerk identity with InsForge relational data and Neon order history.
 */

import { fetchClerkUsers, getInsForgeClient, isInsForgeConfigured, getNeonSql, isNeonConfigured } from './clients.js';
import type { CombinedAdminUser, SanitizedClerkUser, UserRelationalStats } from '../types.js';

export interface DailyUserActivityPoint {
	date: string;
	displayDate: string;
	signups: number;
	signIns: number;
}

export interface ListAdminUsersParams {
	page?: number;
	limit?: number;
	search?: string;
	status?: string;
}

export interface ListAdminUsersResponse {
	users: CombinedAdminUser[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	summary: {
		totalClerkUsers: number;
		totalInsforgeProfiles: number;
		activeUsers: number;
		signupsThisWeek: number;
		signupsThisMonth: number;
	};
	dailyActivity: DailyUserActivityPoint[];
}

export async function listSvgAdminUsers(params: ListAdminUsersParams = {}): Promise<ListAdminUsersResponse> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));

	// 1. Fetch Authoritative Clerk Users
	const { users: clerkUsers, total: clerkTotal } = await fetchClerkUsers({
		page,
		limit,
		search: params.search,
	});

	// 2. Fetch InsForge user profiles & stats map
	const insforgeMap = new Map<string, any>();
	let totalInsforgeProfiles = 0;

	if (isInsForgeConfigured()) {
		try {
			const insforge = getInsForgeClient();
			const [usersRes, savedCardsRes, likesRes, eventsRes] = await Promise.all([
				insforge.database.from('users').select('*').limit(200),
				insforge.database.from('saved_cards').select('user_id, id').limit(500),
				insforge.database.from('card_likes').select('user_id, id').limit(500),
				insforge.database.from('analytics_events').select('user_id, event_name, created_at').limit(1000),
			]);

			if (usersRes?.data && Array.isArray(usersRes.data)) {
				totalInsforgeProfiles = usersRes.data.length;
				usersRes.data.forEach((u: any) => {
					if (u.clerk_user_id) insforgeMap.set(u.clerk_user_id, u);
					if (u.id) insforgeMap.set(String(u.id), u);
					if (u.email) insforgeMap.set(u.email.toLowerCase(), u);
				});
			}
		} catch (e: any) {
			console.error('Failed to load InsForge users data:', e.message);
		}
	}

	// 3. Fetch Neon Purchase data by user_id
	const neonUserPurchases = new Map<string, { count: number; totalSpent: number }>();
	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();
			const orderRows = await sql`
				SELECT 
					user_id,
					COUNT(*)::int as order_count,
					COALESCE(SUM(CASE WHEN order_status = 'paid' OR payment_status = 'captured' THEN amount ELSE 0 END), 0)::bigint as total_paise
				FROM rose_orders
				GROUP BY user_id
			`;
			orderRows.forEach((row: any) => {
				if (row.user_id) {
					neonUserPurchases.set(row.user_id, {
						count: row.order_count || 0,
						totalSpent: Math.round((Number(row.total_paise) || 0) / 100),
					});
				}
			});
		} catch (e: any) {
			console.error('Failed to query Neon order rows for users:', e.message);
		}
	}

	// 4. Combine into CombinedAdminUser
	let combined: CombinedAdminUser[] = clerkUsers.map((clerkUser) => {
		const insforgeRecord =
			insforgeMap.get(clerkUser.id) ||
			insforgeMap.get(clerkUser.email?.toLowerCase());

		const purchaseInfo = neonUserPurchases.get(clerkUser.id) || { count: 0, totalSpent: 0 };

		const stats: UserRelationalStats = {
			cardsCreated: 0,
			savedCards: 0,
			likesCount: 0,
			sharesCount: 0,
			paidOrdersCount: purchaseInfo.count,
			totalSpentRupees: purchaseInfo.totalSpent,
			lastActiveAt: clerkUser.lastActiveAt ? new Date(clerkUser.lastActiveAt).toISOString() : null,
		};

		return {
			...clerkUser,
			stats,
			insforgeRecord: insforgeRecord
				? {
						id: insforgeRecord.id,
						role: insforgeRecord.role,
						avatarUrl: insforgeRecord.avatar_url,
						createdAt: insforgeRecord.created_at,
				  }
				: null,
		};
	});

	// If Clerk users is 0 (or during test fallback), also include users from InsForge if available
	if (combined.length === 0 && isInsForgeConfigured()) {
		try {
			const insforge = getInsForgeClient();
			const { data: fallbackUsers } = await insforge.database.from('users').select('*').limit(limit);
			if (fallbackUsers && Array.isArray(fallbackUsers)) {
				combined = fallbackUsers.map((u: any) => ({
					id: u.clerk_user_id || u.id || 'usr_unknown',
					name: u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User',
					firstName: u.first_name || null,
					lastName: u.last_name || null,
					username: null,
					email: u.email || '',
					emailAddresses: u.email ? [u.email] : [],
					imageUrl: u.avatar_url || '',
					createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
					lastSignInAt: null,
					lastActiveAt: u.updated_at ? new Date(u.updated_at).getTime() : null,
					banned: false,
					locked: false,
					status: 'Active',
					twoFactorEnabled: false,
					phoneNumbers: [],
					externalAccounts: [],
					stats: {
						cardsCreated: 0,
						savedCards: 0,
						likesCount: 0,
						sharesCount: 0,
						paidOrdersCount: 0,
						totalSpentRupees: 0,
					},
					insforgeRecord: {
						id: u.id,
						role: u.role,
						avatarUrl: u.avatar_url,
						createdAt: u.created_at,
					},
				}));
			}
		} catch {}
	}

	// Filter by status if requested
	if (params.status && params.status !== 'all') {
		combined = combined.filter((u) => u.status.toLowerCase() === params.status?.toLowerCase());
	}

	const total = clerkTotal || combined.length;
	const totalPages = Math.ceil(total / limit) || 1;

	// 5. Generate 14-day Daily User Registration & Sign-In Activity Trend
	const daysCount = 14;
	const dailyMap = new Map<string, { signups: number; signIns: number; displayDate: string }>();
	const now = new Date();

	for (let i = daysCount - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateKey = d.toISOString().split('T')[0]!;
		const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		dailyMap.set(dateKey, { signups: 0, signIns: 0, displayDate });
	}

	let signupsThisWeek = 0;
	let signupsThisMonth = 0;
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

	combined.forEach((u) => {
		if (u.createdAt) {
			if (u.createdAt >= sevenDaysAgo) signupsThisWeek++;
			if (u.createdAt >= thirtyDaysAgo) signupsThisMonth++;

			const cDateKey = new Date(u.createdAt).toISOString().split('T')[0]!;
			if (dailyMap.has(cDateKey)) {
				dailyMap.get(cDateKey)!.signups++;
			}
		}

		if (u.lastSignInAt) {
			const sDateKey = new Date(u.lastSignInAt).toISOString().split('T')[0]!;
			if (dailyMap.has(sDateKey)) {
				dailyMap.get(sDateKey)!.signIns++;
			}
		}
	});

	const dailyActivity: DailyUserActivityPoint[] = Array.from(dailyMap.entries()).map(([date, val]) => ({
		date,
		displayDate: val.displayDate,
		signups: val.signups,
		signIns: val.signIns,
	}));

	return {
		users: combined,
		total,
		page,
		limit,
		totalPages,
		summary: {
			totalClerkUsers: total,
			totalInsforgeProfiles,
			activeUsers: combined.filter((u) => u.status === 'Active').length,
			signupsThisWeek,
			signupsThisMonth,
		},
		dailyActivity,
	};
}
