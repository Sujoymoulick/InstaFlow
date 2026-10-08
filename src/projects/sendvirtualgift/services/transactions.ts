/**
 * SendVirtualGift Transaction History & Entitlements Ledger
 * Authoritative source: Neon PostgreSQL (rose_orders, rose_purchase_entitlements, rose_payment_events)
 */

import { getNeonSql, isNeonConfigured } from './clients.js';
import type { NeonRoseOrder, NeonRoseEntitlement, NeonRosePaymentEvent } from '../types.js';

export interface TransactionAuditItem {
	order: NeonRoseOrder;
	entitlement?: NeonRoseEntitlement | null;
	events: NeonRosePaymentEvent[];
	deliveryStatus: 'Delivered' | 'Pending Verification' | 'Failed' | 'Refunded';
}

export interface ListTransactionsResult {
	transactions: TransactionAuditItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export async function listSvgTransactions(params: { page?: number; limit?: number; search?: string } = {}): Promise<ListTransactionsResult> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));
	const offset = (page - 1) * limit;

	const transactions: TransactionAuditItem[] = [];
	let total = 0;

	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();

			const countRes = await sql`SELECT COUNT(*)::int as total FROM rose_orders`;
			total = countRes[0]?.total || 0;

			const orders = await sql`
				SELECT *
				FROM rose_orders
				ORDER BY created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`;

			const orderIds = orders.map((o: any) => o.id);

			let entitlements: any[] = [];
			let paymentEvents: any[] = [];

			if (orderIds.length > 0) {
				try {
					entitlements = await sql`
						SELECT * FROM rose_purchase_entitlements
						WHERE order_id = ANY(${orderIds})
					`;
				} catch {}

				try {
					paymentEvents = await sql`
						SELECT * FROM rose_payment_events
						ORDER BY received_at DESC
						LIMIT 50
					`;
				} catch {}
			}

			const entitlementMap = new Map<string, any>();
			entitlements.forEach((e: any) => entitlementMap.set(e.order_id, e));

			orders.forEach((r: any) => {
				const isPaid = r.order_status === 'paid' || r.payment_status === 'captured';
				const entitlement = entitlementMap.get(r.id) || null;

				let deliveryStatus: 'Delivered' | 'Pending Verification' | 'Failed' | 'Refunded' = 'Pending Verification';
				if (isPaid && r.gift_token) {
					deliveryStatus = 'Delivered';
				} else if (r.order_status === 'failed' || r.payment_status === 'failed') {
					deliveryStatus = 'Failed';
				} else if (r.order_status === 'refunded') {
					deliveryStatus = 'Refunded';
				}

				transactions.push({
					order: {
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
					},
					entitlement,
					events: paymentEvents.filter((ev: any) => ev.gateway_payment_id === r.gateway_payment_id),
					deliveryStatus,
				});
			});
		} catch (e: any) {
			console.error('Failed to list transactions from Neon:', e.message);
		}
	}

	const totalPages = Math.ceil(total / limit) || 1;

	return {
		transactions,
		total,
		page,
		limit,
		totalPages,
	};
}
