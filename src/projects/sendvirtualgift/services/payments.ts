/**
 * SendVirtualGift Payments & Razorpay Reconciliation Service
 * Authoritative source: Neon PostgreSQL (rose_orders, rose_payment_events)
 */

import { getNeonSql, isNeonConfigured, fetchRazorpayPayments, isRazorpayConfigured } from './clients.js';
import type { NeonRoseOrder } from '../types.js';

export interface PaymentSummary {
	orders: NeonRoseOrder[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	stats: {
		totalRevenueRupees: number;
		capturedCount: number;
		pendingCount: number;
		failedCount: number;
		currency: string;
	};
	razorpayLiveFeed: any[];
}

export async function listSvgPayments(params: { page?: number; limit?: number; search?: string; status?: string } = {}): Promise<PaymentSummary> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));
	const offset = (page - 1) * limit;

	let orders: NeonRoseOrder[] = [];
	let total = 0;
	let totalRevenuePaise = 0;
	let capturedCount = 0;
	let pendingCount = 0;
	let failedCount = 0;
	let razorpayLiveFeed: any[] = [];

	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();

			const statsRes = await sql`
				SELECT 
					COUNT(*)::int as total,
					COUNT(CASE WHEN order_status = 'paid' OR payment_status = 'captured' THEN 1 END)::int as captured,
					COUNT(CASE WHEN order_status IN ('pending', 'payment_initiated', 'payment_verification_pending') THEN 1 END)::int as pending,
					COUNT(CASE WHEN order_status = 'failed' OR payment_status = 'failed' THEN 1 END)::int as failed,
					COALESCE(SUM(CASE WHEN order_status = 'paid' OR payment_status = 'captured' THEN amount ELSE 0 END), 0)::bigint as revenue_paise
				FROM rose_orders
			`;

			if (statsRes[0]) {
				total = statsRes[0].total || 0;
				capturedCount = statsRes[0].captured || 0;
				pendingCount = statsRes[0].pending || 0;
				failedCount = statsRes[0].failed || 0;
				totalRevenuePaise = Number(statsRes[0].revenue_paise) || 0;
			}

			const rows = await sql`
				SELECT *
				FROM rose_orders
				ORDER BY created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`;

			orders = rows.map((r: any) => ({
				id: r.id,
				user_id: r.user_id,
				product_slug: r.product_slug || 'rose-forever-3d',
				amount: Number(r.amount) || 9900,
				currency: r.currency || 'INR',
				payment_gateway: r.payment_gateway || 'razorpay',
				gateway_order_id: r.gateway_order_id,
				gateway_payment_id: r.gateway_payment_id,
				gateway_signature: r.gateway_signature ? `${r.gateway_signature.substring(0, 8)}...` : null,
				order_status: r.order_status,
				payment_status: r.payment_status,
				created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
				updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
				paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
				gift_token: r.gift_token,
				receipt_number: r.receipt_number,
				customization_data: r.customization_data,
				metadata: r.metadata,
			}));
		} catch (e: any) {
			console.error('Failed to list payments from Neon:', e.message);
		}
	}

	// Fetch live Razorpay feed if configured
	if (isRazorpayConfigured()) {
		try {
			razorpayLiveFeed = await fetchRazorpayPayments(10);
		} catch {}
	}

	// Filter in memory if search query present
	if (params.search && params.search.trim()) {
		const s = params.search.trim().toLowerCase();
		orders = orders.filter(
			(o) =>
				o.id.toLowerCase().includes(s) ||
				o.user_id.toLowerCase().includes(s) ||
				(o.receipt_number && o.receipt_number.toLowerCase().includes(s)) ||
				(o.gateway_order_id && o.gateway_order_id.toLowerCase().includes(s)) ||
				(o.gateway_payment_id && o.gateway_payment_id.toLowerCase().includes(s))
		);
	}

	const totalPages = Math.ceil(total / limit) || 1;

	return {
		orders,
		total,
		page,
		limit,
		totalPages,
		stats: {
			totalRevenueRupees: Math.round(totalRevenuePaise / 100),
			capturedCount,
			pendingCount,
			failedCount,
			currency: 'INR',
		},
		razorpayLiveFeed,
	};
}
