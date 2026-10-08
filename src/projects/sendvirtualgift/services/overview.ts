/**
 * Overview KPIs and aggregate metric aggregator for SendVirtualGift
 * Combines Neon PostgreSQL, InsForge PostgreSQL, Clerk, and Razorpay
 */

import {
	getNeonSql,
	isNeonConfigured,
	getInsForgeClient,
	isInsForgeConfigured,
	fetchClerkTotalUserCount,
	isClerkConfigured,
	isRazorpayConfigured,
	isCloudinaryConfigured,
} from './clients.js';
import type { SvgOverviewKpis } from '../types.js';

export async function getSvgOverviewKpis(): Promise<SvgOverviewKpis> {
	let totalRegisteredUsers = 0;
	let totalAnonymousUsers = 0;
	let totalCardsGenerated = 0;
	let totalAnonymousCards = 0;
	let totalAuthUserCards = 0;
	let totalCardViews = 0;
	let totalShares = 0;
	let totalCardLikes = 0;
	let totalPaidPurchases = 0;
	let successfulPayments = 0;
	let failedPayments = 0;
	let pendingPayments = 0;
	let totalRevenueRupees = 0;
	let activeRateLimitEvents = 0;

	let neonStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
	let insforgeStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
	let clerkStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
	let razorpayStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
	let cloudinaryStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';

	// 1. Neon Stats (Authoritative for Paid Orders, Revenue, Entitlements, Backups)
	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();
			const [orderStats] = await sql`
				SELECT 
					COUNT(*)::int as total_orders,
					COUNT(CASE WHEN order_status = 'paid' OR payment_status = 'captured' THEN 1 END)::int as paid_orders,
					COUNT(CASE WHEN order_status = 'failed' OR payment_status = 'failed' THEN 1 END)::int as failed_orders,
					COUNT(CASE WHEN order_status IN ('pending', 'payment_initiated', 'payment_verification_pending') THEN 1 END)::int as pending_orders,
					COALESCE(SUM(CASE WHEN order_status = 'paid' OR payment_status = 'captured' THEN amount ELSE 0 END), 0)::bigint as total_revenue_paise
				FROM rose_orders
			`;

			if (orderStats) {
				totalPaidPurchases = orderStats.paid_orders || 0;
				successfulPayments = orderStats.paid_orders || 0;
				failedPayments = orderStats.failed_orders || 0;
				pendingPayments = orderStats.pending_orders || 0;
				totalRevenueRupees = Math.round((Number(orderStats.total_revenue_paise) || 0) / 100);
			}
			neonStatus = 'connected';
		} catch (e: any) {
			console.error('Failed to fetch Neon stats for overview:', e.message);
			neonStatus = 'degraded';
		}
	}

	// 2. InsForge Stats (Application BaaS: Users, Analytics Events, Likes, Saved Cards)
	if (isInsForgeConfigured()) {
		try {
			const insforge = getInsForgeClient();
			const [eventsRes, likesRes, savedCardsRes, insforgeUsersRes] = await Promise.all([
				insforge.database.from('analytics_events').select('*', { count: 'exact' }),
				insforge.database.from('card_likes').select('id', { count: 'exact' }),
				insforge.database.from('saved_cards').select('id', { count: 'exact' }),
				insforge.database.from('users').select('id', { count: 'exact' }),
			]);

			totalCardLikes = likesRes?.count ?? (likesRes?.data?.length || 0);
			const insforgeUserCount = insforgeUsersRes?.count ?? (insforgeUsersRes?.data?.length || 0);

			if (eventsRes?.data && Array.isArray(eventsRes.data)) {
				const events = eventsRes.data;
				const anonymousIds = new Set<string>();

				events.forEach((ev: any) => {
					if (ev.anonymous_id) anonymousIds.add(ev.anonymous_id);

					const name = String(ev.event_name || '').toLowerCase();
					if (name.includes('create') || name.includes('generate')) {
						totalCardsGenerated++;
						if (ev.is_no_signup_card || ev.anonymous_id) {
							totalAnonymousCards++;
						} else {
							totalAuthUserCards++;
						}
					} else if (name.includes('view')) {
						totalCardViews++;
					} else if (name.includes('share')) {
						totalShares++;
					} else if (name.includes('rate_limit') || name.includes('blocked')) {
						activeRateLimitEvents++;
					}
				});

				totalAnonymousUsers = anonymousIds.size;
			}

			// If event log has 0 cards but saved_cards has entries, add saved cards count
			if (totalCardsGenerated === 0 && savedCardsRes.count) {
				totalCardsGenerated = savedCardsRes.count;
			}

			insforgeStatus = 'connected';
		} catch (e: any) {
			console.error('Failed to fetch InsForge stats for overview:', e.message);
			insforgeStatus = 'degraded';
		}
	}

	// 3. Clerk Auth Count (Authoritative)
	if (isClerkConfigured()) {
		try {
			totalRegisteredUsers = await fetchClerkTotalUserCount();
			clerkStatus = 'connected';
		} catch (e: any) {
			console.error('Failed to fetch Clerk total user count:', e.message);
			clerkStatus = 'degraded';
		}
	}

	// 4. Razorpay & Cloudinary Status
	razorpayStatus = isRazorpayConfigured() ? 'connected' : 'disconnected';
	cloudinaryStatus = isCloudinaryConfigured() ? 'connected' : 'disconnected';

	return {
		totalRegisteredUsers,
		totalAnonymousUsers,
		totalCardsGenerated: Math.max(totalCardsGenerated, totalAnonymousCards + totalAuthUserCards),
		totalAnonymousCards,
		totalAuthUserCards,
		totalCardViews,
		totalShares,
		totalCardLikes,
		totalPaidPurchases,
		successfulPayments,
		failedPayments,
		pendingPayments,
		totalRevenueRupees,
		activeRateLimitEvents,
		neonStatus,
		insforgeStatus,
		clerkStatus,
		razorpayStatus,
		cloudinaryStatus,
		lastUpdated: new Date().toISOString(),
	};
}
