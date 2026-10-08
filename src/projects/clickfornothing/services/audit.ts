/**
 * ClickForNothing Moderation Audit Log Service
 * Persists all admin actions to Neon DB with fallback memory storage.
 */

import { getCfnSql, isCfnDatabaseConfigured } from './clients.js';
import type { SubmissionAuditLogEntry } from '../types.js';

const inMemoryAuditLogs: SubmissionAuditLogEntry[] = [];

/**
 * Record an administrative action in the audit log
 */
export async function recordAuditLog(entry: {
	submissionId?: string | null;
	adminEmail: string;
	action: string;
	previousStatus?: string | null;
	newStatus?: string | null;
	details?: string | null;
}): Promise<void> {
	const logRecord: SubmissionAuditLogEntry = {
		id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
		submissionId: entry.submissionId || null,
		adminEmail: entry.adminEmail,
		action: entry.action,
		previousStatus: entry.previousStatus || null,
		newStatus: entry.newStatus || null,
		details: entry.details || null,
		createdAt: new Date().toISOString(),
	};

	inMemoryAuditLogs.unshift(logRecord);
	if (inMemoryAuditLogs.length > 200) {
		inMemoryAuditLogs.pop();
	}

	if (!isCfnDatabaseConfigured()) return;

	try {
		const sql = getCfnSql();
		await sql`
			INSERT INTO submission_audit_logs (
				submission_id,
				admin_email,
				action,
				previous_status,
				new_status,
				details,
				created_at
			) VALUES (
				${entry.submissionId || null},
				${entry.adminEmail},
				${entry.action},
				${entry.previousStatus || null},
				${entry.newStatus || null},
				${entry.details || null},
				NOW()
			);
		`;
	} catch (err) {
		console.warn('[ClickForNothing Audit] Failed to persist audit record to DB:', err);
	}
}

/**
 * List recent audit logs
 */
export async function listAuditLogs(limit = 20): Promise<SubmissionAuditLogEntry[]> {
	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const rows = await sql`
				SELECT * FROM submission_audit_logs ORDER BY created_at DESC LIMIT ${limit};
			`;

			if (rows.length > 0) {
				return rows.map((r) => ({
					id: String(r.id),
					submissionId: r.submission_id ? String(r.submission_id) : null,
					adminEmail: r.admin_email,
					action: r.action,
					previousStatus: r.previous_status,
					newStatus: r.new_status,
					details: r.details,
					createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
				}));
			}
		} catch (err) {
			console.warn('[ClickForNothing Audit] Querying DB audit logs failed:', err);
		}
	}

	return inMemoryAuditLogs.slice(0, limit);
}
