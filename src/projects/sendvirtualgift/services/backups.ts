/**
 * SendVirtualGift Paid Card Cloud Backup Service
 * Audits and monitors Neon PostgreSQL cloud backups for paid templates.
 * Neon PostgreSQL is the authoritative store for paid backups.
 */

import { getNeonSql, isNeonConfigured } from './clients.js';
import type { NeonRoseCardBackup } from '../types.js';

export interface ListBackupsParams {
	page?: number;
	limit?: number;
	search?: string;
	status?: string;
}

export interface ListBackupsResult {
	backups: NeonRoseCardBackup[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	activeBackupsCount: number;
	archivedBackupsCount: number;
}

export async function listSvgCardBackups(params: ListBackupsParams = {}): Promise<ListBackupsResult> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));
	const offset = (page - 1) * limit;

	let backups: NeonRoseCardBackup[] = [];
	let total = 0;
	let activeBackupsCount = 0;
	let archivedBackupsCount = 0;

	if (isNeonConfigured()) {
		try {
			const sql = getNeonSql();

			const countRes = await sql`
				SELECT 
					COUNT(*)::int as total,
					COUNT(CASE WHEN backup_status = 'active' THEN 1 END)::int as active_count,
					COUNT(CASE WHEN backup_status = 'archived' THEN 1 END)::int as archived_count
				FROM rose_card_backups
			`;

			if (countRes[0]) {
				total = countRes[0].total || 0;
				activeBackupsCount = countRes[0].active_count || 0;
				archivedBackupsCount = countRes[0].archived_count || 0;
			}

			const rows = await sql`
				SELECT 
					b.id,
					b.card_id,
					b.user_id,
					b.order_id,
					b.template_id,
					b.card_title,
					b.card_url,
					b.thumbnail_url,
					b.backup_status,
					b.created_at,
					b.updated_at,
					COALESCE(o.receipt_number, '') as receipt_number,
					COALESCE(o.order_status, 'paid') as order_status,
					COALESCE(o.paid_at, b.created_at) as paid_at
				FROM rose_card_backups b
				LEFT JOIN rose_orders o ON b.order_id = o.id
				ORDER BY b.created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`;

			backups = rows.map((r: any) => ({
				id: r.id,
				card_id: r.card_id,
				user_id: r.user_id,
				order_id: r.order_id,
				template_id: r.template_id,
				card_title: r.card_title || '3D Forever Rose',
				card_url: r.card_url || `/g/${r.card_id}`,
				thumbnail_url: r.thumbnail_url,
				card_data: {},
				backup_status: r.backup_status || 'active',
				created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
				updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
				receipt_number: r.receipt_number,
				order_status: r.order_status,
				paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
			}));
		} catch (e: any) {
			console.error('Failed to list backups from Neon:', e.message);
		}
	}

	// Filter in memory if search query present
	if (params.search && params.search.trim()) {
		const s = params.search.trim().toLowerCase();
		backups = backups.filter(
			(b) =>
				b.card_id.toLowerCase().includes(s) ||
				b.user_id.toLowerCase().includes(s) ||
				(b.receipt_number && b.receipt_number.toLowerCase().includes(s)) ||
				b.card_title.toLowerCase().includes(s)
		);
	}

	const totalPages = Math.ceil(total / limit) || 1;

	return {
		backups,
		total,
		page,
		limit,
		totalPages,
		activeBackupsCount,
		archivedBackupsCount,
	};
}
