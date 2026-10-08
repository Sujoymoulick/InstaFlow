/**
 * SendVirtualGift Invoices & Receipt Generation Service
 * Generates verified tax invoices and customer receipts from authoritative Neon order records.
 */

import { getNeonSql, isNeonConfigured } from './clients.js';
import type { InvoiceRecord } from '../types.js';

export interface ListInvoicesResult {
	invoices: InvoiceRecord[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	totalInvoicedRupees: number;
}

export async function listSvgInvoices(params: { page?: number; limit?: number; search?: string } = {}): Promise<ListInvoicesResult> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));
	const offset = (page - 1) * limit;

	const invoices: InvoiceRecord[] = [];
	let total = 0;
	let totalInvoicedRupees = 0;

	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();

			const countRes = await sql`
				SELECT 
					COUNT(*)::int as total,
					COALESCE(SUM(amount), 0)::bigint as total_paise
				FROM rose_orders
				WHERE order_status = 'paid' OR payment_status = 'captured'
			`;

			total = countRes[0]?.total || 0;
			totalInvoicedRupees = Math.round((Number(countRes[0]?.total_paise) || 0) / 100);

			const rows = await sql`
				SELECT *
				FROM rose_orders
				WHERE order_status = 'paid' OR payment_status = 'captured'
				ORDER BY paid_at DESC, created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`;

			rows.forEach((r: any) => {
				const totalRupees = Math.round((Number(r.amount) || 9900) / 100);
				const subtotal = Number((totalRupees / 1.18).toFixed(2));
				const tax = Number((totalRupees - subtotal).toFixed(2));

				invoices.push({
					id: r.id,
					receiptNumber: r.receipt_number || `INV-${r.id.substring(0, 8).toUpperCase()}`,
					orderId: r.id,
					paymentId: r.gateway_payment_id || r.gateway_order_id || 'PAY_OFFLINE',
					customerName: r.customization_data?.senderName || r.customization_data?.userName || 'Valued Customer',
					customerEmail: r.customization_data?.userEmail || 'customer@sendvirtualgift.com',
					productName: '3D Forever Rose - Valentine Interactive Card',
					productSlug: r.product_slug || 'rose-forever-3d',
					subtotal,
					tax,
					total: totalRupees,
					currency: r.currency || 'INR',
					status: 'paid',
					createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
					paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : new Date().toISOString(),
				});
			});
		} catch (e: any) {
			console.error('Failed to list invoices from Neon:', e.message);
		}
	}

	const totalPages = Math.ceil(total / limit) || 1;

	return {
		invoices,
		total,
		page,
		limit,
		totalPages,
		totalInvoicedRupees,
	};
}

export async function getSvgInvoiceById(orderId: string): Promise<InvoiceRecord | null> {
	if (!isNeonConfigured()) return null;
	try {
		const sql = getNeonSql();
		const [r] = await sql`
			SELECT * FROM rose_orders
			WHERE id = ${orderId} OR receipt_number = ${orderId}
			LIMIT 1
		`;
		if (!r) return null;

		const totalRupees = Math.round((Number(r.amount) || 9900) / 100);
		const subtotal = Number((totalRupees / 1.18).toFixed(2));
		const tax = Number((totalRupees - subtotal).toFixed(2));

		return {
			id: r.id,
			receiptNumber: r.receipt_number || `INV-${r.id.substring(0, 8).toUpperCase()}`,
			orderId: r.id,
			paymentId: r.gateway_payment_id || r.gateway_order_id || 'PAY_OFFLINE',
			customerName: r.customization_data?.senderName || r.customization_data?.userName || 'Valued Customer',
			customerEmail: r.customization_data?.userEmail || 'customer@sendvirtualgift.com',
			productName: '3D Forever Rose - Valentine Interactive Card',
			productSlug: r.product_slug || 'rose-forever-3d',
			subtotal,
			tax,
			total: totalRupees,
			currency: r.currency || 'INR',
			status: r.order_status === 'paid' || r.payment_status === 'captured' ? 'paid' : 'pending',
			createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
			paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : new Date().toISOString(),
		};
	} catch (e: any) {
		console.error('Failed to fetch invoice by ID from Neon:', e.message);
		return null;
	}
}
