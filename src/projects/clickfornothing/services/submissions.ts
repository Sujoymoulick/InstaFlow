import { getCfnSql, isCfnDatabaseConfigured } from './clients.js';
import type {
	ClickForNothingSubmission,
	SubmissionFilterOptions,
	SubmissionListResult,
	SubmissionStats,
	SubmissionStatus,
} from '../types.js';
import { recordAuditLog, ensureAuditTable } from './audit.js';

/**
 * Normalizes raw row from `website_submissions` into ClickForNothingSubmission
 */
function mapWebsiteSubmissionRow(row: any): ClickForNothingSubmission {
	let status: SubmissionStatus = 'Pending Review';
	const rawStatus = String(row.status || '').toLowerCase().trim();
	if (rawStatus === 'approved') status = 'Approved';
	else if (rawStatus === 'published') status = 'Published';
	else if (rawStatus === 'rejected') status = 'Rejected';
	else status = 'Pending Review';

	const tags = Array.isArray(row.tags)
		? row.tags
		: row.preview_info?.tags
		? row.preview_info.tags
		: [];

	const createdAtIso = row.created_at || row.submitted_at ? new Date(row.created_at || row.submitted_at).toISOString() : new Date().toISOString();
	const updatedAtIso = row.updated_at ? new Date(row.updated_at).toISOString() : createdAtIso;

	return {
		id: String(row.id),
		userId: String(row.user_id || 'anonymous_user'),
		userEmail: row.user_email || null,
		userName: row.user_name || null,
		userAvatarUrl: row.user_avatar_url || null,
		title: row.name || row.title || 'Untitled Submission',
		description: row.description || null,
		url: row.url || '',
		previewImageUrl: row.thumbnail_url || row.preview_image_url || null,
		category: row.category || 'General',
		tags,
		status,
		rejectionReason: row.rejection_reason || null,
		reviewedBy: row.reviewed_by || null,
		reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
		publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
		metadata: row.preview_info || {},
		createdAt: createdAtIso,
		updatedAt: updatedAtIso,
	};
}

/**
 * Convert frontend / UI status to DB status string ('pending_review', 'approved', 'published', 'rejected')
 */
function toDbStatus(st?: string): string {
	if (!st) return '';
	const clean = st.toLowerCase().replace(/[-_ ]+/g, '');
	if (clean === 'approved') return 'approved';
	if (clean === 'published') return 'published';
	if (clean === 'rejected') return 'rejected';
	if (clean.includes('pending')) return 'pending_review';
	return clean;
}

// In-memory fallback
const fallbackSubmissions: ClickForNothingSubmission[] = [
	{
		id: '1',
		userId: 'user_3KPCSrKhicGFvCRmdaPzGqu0Q1e',
		userEmail: 'sujoymoulick05@gmail.com',
		userName: 'Sujoy Moulick',
		userAvatarUrl: null,
		title: 'FreePDFly',
		description: 'Online free PDF tools suite',
		url: 'https://www.freepdfly.com/',
		previewImageUrl: null,
		category: 'useless-websites',
		tags: ['tools', 'pdf'],
		status: 'Pending Review',
		rejectionReason: null,
		reviewedBy: null,
		reviewedAt: null,
		publishedAt: null,
		metadata: {},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
];

/**
 * List all submissions with server-side search, filtering, pagination, and sorting
 */
export async function listSubmissions(options: SubmissionFilterOptions = {}): Promise<SubmissionListResult> {
	const page = Math.max(1, options.page || 1);
	const limit = Math.min(100, Math.max(1, options.limit || 15));
	const offset = (page - 1) * limit;

	if (isCfnDatabaseConfigured()) {
		try {
			await ensureAuditTable();
			const sql = getCfnSql();

			// Fetch all rows to allow flexible filtering
			const rows = await sql`
				SELECT * FROM website_submissions ORDER BY id DESC;
			`;

			let submissions = rows.map(mapWebsiteSubmissionRow);

			// 1. Search
			if (options.search?.trim()) {
				const q = options.search.trim().toLowerCase();
				submissions = submissions.filter(
					(s) =>
						s.title.toLowerCase().includes(q) ||
						(s.description && s.description.toLowerCase().includes(q)) ||
						s.url.toLowerCase().includes(q) ||
						(s.userEmail && s.userEmail.toLowerCase().includes(q)) ||
						(s.userName && s.userName.toLowerCase().includes(q)),
				);
			}

			// 2. Status
			if (options.status && options.status !== 'all') {
				const filterDbStatus = toDbStatus(options.status);
				submissions = submissions.filter((s) => toDbStatus(s.status) === filterDbStatus);
			}

			// 3. Category
			if (options.category && options.category !== 'all') {
				submissions = submissions.filter((s) => s.category.toLowerCase() === options.category!.toLowerCase());
			}

			// 4. Date Range
			if (options.dateRange && options.dateRange !== 'all') {
				const now = Date.now();
				let cutoff = 0;
				if (options.dateRange === 'today') cutoff = now - 24 * 3600 * 1000;
				else if (options.dateRange === '7d') cutoff = now - 7 * 24 * 3600 * 1000;
				else if (options.dateRange === '30d') cutoff = now - 30 * 24 * 3600 * 1000;
				submissions = submissions.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
			}

			// 5. Sorting
			if (options.sort === 'oldest') {
				submissions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
			} else if (options.sort === 'title_asc') {
				submissions.sort((a, b) => a.title.localeCompare(b.title));
			} else if (options.sort === 'title_desc') {
				submissions.sort((a, b) => b.title.localeCompare(a.title));
			} else {
				submissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			}

			const total = submissions.length;
			const paged = submissions.slice(offset, offset + limit);

			return {
				submissions: paged,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit) || 1,
			};
		} catch (err) {
			console.warn('[ClickForNothing Submissions] Neon DB query failed, falling back:', err);
		}
	}

	// In-memory fallback
	let filtered = [...fallbackSubmissions];
	if (options.search?.trim()) {
		const q = options.search.trim().toLowerCase();
		filtered = filtered.filter((s) => s.title.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
	}
	if (options.status && options.status !== 'all') {
		const filterDbStatus = toDbStatus(options.status);
		filtered = filtered.filter((s) => toDbStatus(s.status) === filterDbStatus);
	}

	const total = filtered.length;
	return {
		submissions: filtered.slice(offset, offset + limit),
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit) || 1,
	};
}

/**
 * Retrieve single submission by ID
 */
export async function getSubmissionById(id: string): Promise<ClickForNothingSubmission | null> {
	if (!id) return null;

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const numericId = parseInt(id, 10);
			let rows: any[] = [];
			if (!isNaN(numericId)) {
				rows = await sql`SELECT * FROM website_submissions WHERE id = ${numericId} LIMIT 1;`;
			}
			if (rows.length === 0) {
				rows = await sql`SELECT * FROM website_submissions WHERE id::text = ${id} LIMIT 1;`;
			}
			if (rows.length > 0) {
				return mapWebsiteSubmissionRow(rows[0]);
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] Fetch single DB error:', err);
		}
	}

	const found = fallbackSubmissions.find((s) => s.id === id);
	return found ? { ...found } : null;
}

/**
 * Real statistics overview from database
 */
export async function getSubmissionStats(): Promise<SubmissionStats> {
	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const rows = await sql`
				SELECT 
					count(*) as total,
					count(CASE WHEN lower(status) = 'pending_review' OR lower(status) = 'pending review' THEN 1 END) as pending,
					count(CASE WHEN lower(status) = 'approved' THEN 1 END) as approved,
					count(CASE WHEN lower(status) = 'published' THEN 1 END) as published,
					count(CASE WHEN lower(status) = 'rejected' THEN 1 END) as rejected,
					count(DISTINCT user_id) as users_count
				FROM website_submissions;
			`;

			const res = rows[0];
			if (res) {
				return {
					totalSubmissions: Number(res.total || 0),
					pendingReview: Number(res.pending || 0),
					approved: Number(res.approved || 0),
					published: Number(res.published || 0),
					rejected: Number(res.rejected || 0),
					totalUsers: Math.max(1, Number(res.users_count || 0)),
				};
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] Querying stats from DB failed:', err);
		}
	}

	return {
		totalUsers: 1,
		totalSubmissions: 1,
		pendingReview: 1,
		approved: 0,
		published: 0,
		rejected: 0,
	};
}

/**
 * Create a new user submission in Neon
 */
export async function createSubmission(data: {
	userId: string;
	userEmail?: string | null;
	userName?: string | null;
	userAvatarUrl?: string | null;
	title: string;
	description?: string | null;
	url: string;
	previewImageUrl?: string | null;
	category?: string;
	tags?: string[];
	metadata?: Record<string, any>;
}): Promise<ClickForNothingSubmission> {
	if (!data.userId || !data.title || !data.url) {
		throw new Error('userId, title, and valid url are required fields.');
	}

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const previewInfo = JSON.stringify({
				...(data.metadata || {}),
				tags: data.tags || [],
			});

			const rows = await sql`
				INSERT INTO website_submissions (
					url,
					name,
					description,
					category,
					user_id,
					user_email,
					user_name,
					status,
					thumbnail_url,
					preview_info,
					created_at,
					updated_at,
					submitted_at
				) VALUES (
					${data.url.trim()},
					${data.title.trim()},
					${data.description?.trim() || ''},
					${data.category?.trim() || 'useless-websites'},
					${data.userId.trim()},
					${data.userEmail?.trim() || null},
					${data.userName?.trim() || null},
					'pending_review',
					${data.previewImageUrl?.trim() || null},
					${previewInfo}::jsonb,
					NOW(),
					NOW(),
					NOW()
				)
				RETURNING *;
			`;

			if (rows.length > 0) {
				return mapWebsiteSubmissionRow(rows[0]);
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] DB insert error:', err);
		}
	}

	const fallback: ClickForNothingSubmission = {
		id: String(Date.now()),
		userId: data.userId,
		userEmail: data.userEmail || null,
		userName: data.userName || null,
		userAvatarUrl: data.userAvatarUrl || null,
		title: data.title,
		description: data.description || null,
		url: data.url,
		previewImageUrl: data.previewImageUrl || null,
		category: data.category || 'General',
		tags: data.tags || [],
		status: 'Pending Review',
		rejectionReason: null,
		reviewedBy: null,
		reviewedAt: null,
		publishedAt: null,
		metadata: data.metadata || {},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	fallbackSubmissions.unshift(fallback);
	return fallback;
}

/**
 * Approve a submission (pending_review -> approved)
 */
export async function approveSubmission(id: string, adminEmail: string): Promise<ClickForNothingSubmission> {
	const current = await getSubmissionById(id);
	if (!current) {
		throw new Error(`Submission with ID "${id}" was not found.`);
	}

	const prevStatus = current.status;
	const numericId = parseInt(id, 10);

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const rows = isNaN(numericId)
				? await sql`
					UPDATE website_submissions
					SET status = 'approved',
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id::text = ${id}
					RETURNING *;
				  `
				: await sql`
					UPDATE website_submissions
					SET status = 'approved',
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id = ${numericId}
					RETURNING *;
				  `;

			await recordAuditLog({
				submissionId: id,
				adminEmail,
				action: 'Approved Submission',
				previousStatus: prevStatus,
				newStatus: 'Approved',
				details: `Approved site submission "${current.title}" (${current.url})`,
			});

			if (rows.length > 0) {
				return mapWebsiteSubmissionRow(rows[0]);
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] DB approve error:', err);
		}
	}

	current.status = 'Approved';
	current.reviewedAt = new Date().toISOString();
	current.updatedAt = new Date().toISOString();
	return current;
}

/**
 * Reject a submission with reason
 */
export async function rejectSubmission(
	id: string,
	adminEmail: string,
	rejectionReason?: string,
): Promise<ClickForNothingSubmission> {
	const current = await getSubmissionById(id);
	if (!current) {
		throw new Error(`Submission with ID "${id}" was not found.`);
	}

	const prevStatus = current.status;
	const cleanReason = rejectionReason?.trim() || 'Submission does not meet directory quality standards.';
	const numericId = parseInt(id, 10);

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const rows = isNaN(numericId)
				? await sql`
					UPDATE website_submissions
					SET status = 'rejected',
						rejection_reason = ${cleanReason},
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id::text = ${id}
					RETURNING *;
				  `
				: await sql`
					UPDATE website_submissions
					SET status = 'rejected',
						rejection_reason = ${cleanReason},
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id = ${numericId}
					RETURNING *;
				  `;

			await recordAuditLog({
				submissionId: id,
				adminEmail,
				action: 'Rejected Submission',
				previousStatus: prevStatus,
				newStatus: 'Rejected',
				details: `Rejected submission "${current.title}". Reason: ${cleanReason}`,
			});

			if (rows.length > 0) {
				return mapWebsiteSubmissionRow(rows[0]);
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] DB reject error:', err);
		}
	}

	current.status = 'Rejected';
	current.rejectionReason = cleanReason;
	current.reviewedAt = new Date().toISOString();
	current.updatedAt = new Date().toISOString();
	return current;
}

/**
 * Publish a submission (approved/pending -> published)
 */
export async function publishSubmission(id: string, adminEmail: string): Promise<ClickForNothingSubmission> {
	const current = await getSubmissionById(id);
	if (!current) {
		throw new Error(`Submission with ID "${id}" was not found.`);
	}

	const prevStatus = current.status;
	const numericId = parseInt(id, 10);

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			const rows = isNaN(numericId)
				? await sql`
					UPDATE website_submissions
					SET status = 'published',
						published_at = NOW(),
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id::text = ${id}
					RETURNING *;
				  `
				: await sql`
					UPDATE website_submissions
					SET status = 'published',
						published_at = NOW(),
						reviewed_at = NOW(),
						updated_at = NOW()
					WHERE id = ${numericId}
					RETURNING *;
				  `;

			await recordAuditLog({
				submissionId: id,
				adminEmail,
				action: 'Published Submission',
				previousStatus: prevStatus,
				newStatus: 'Published',
				details: `Published submission "${current.title}" (${current.url}) live to directory`,
			});

			if (rows.length > 0) {
				return mapWebsiteSubmissionRow(rows[0]);
			}
		} catch (err) {
			console.warn('[ClickForNothing Submissions] DB publish error:', err);
		}
	}

	current.status = 'Published';
	current.publishedAt = new Date().toISOString();
	current.updatedAt = new Date().toISOString();
	return current;
}

/**
 * Delete a submission permanently from Neon DB and record audit log
 */
export async function deleteSubmission(
	id: string,
	adminEmail: string,
): Promise<{ success: boolean; id: string }> {
	const current = await getSubmissionById(id);
	const numericId = parseInt(id, 10);

	if (isCfnDatabaseConfigured()) {
		try {
			const sql = getCfnSql();
			if (isNaN(numericId)) {
				await sql`
					DELETE FROM website_submissions
					WHERE id::text = ${id};
				`;
			} else {
				await sql`
					DELETE FROM website_submissions
					WHERE id = ${numericId};
				`;
			}

			await recordAuditLog({
				submissionId: id,
				adminEmail,
				action: 'Deleted Submission',
				previousStatus: current ? current.status : 'Unknown',
				newStatus: 'Deleted',
				details: current
					? `Permanently deleted submission "${current.title}" (${current.url})`
					: `Permanently deleted submission ID #${id}`,
			});

			return { success: true, id };
		} catch (err) {
			console.warn('[ClickForNothing Submissions] DB delete error:', err);
		}
	}

	const idx = fallbackSubmissions.findIndex((s) => s.id === id);
	if (idx >= 0) {
		fallbackSubmissions.splice(idx, 1);
	}

	return { success: true, id };
}

/**
 * Bulk approve multiple submissions
 */
export async function bulkApproveSubmissions(
	ids: string[],
	adminEmail: string,
): Promise<{ success: boolean; affectedCount: number }> {
	let count = 0;
	for (const id of ids) {
		try {
			await approveSubmission(id, adminEmail);
			count++;
		} catch {}
	}
	return { success: true, affectedCount: count };
}

/**
 * Bulk reject multiple submissions
 */
export async function bulkRejectSubmissions(
	ids: string[],
	adminEmail: string,
	reason?: string,
): Promise<{ success: boolean; affectedCount: number }> {
	let count = 0;
	for (const id of ids) {
		try {
			await rejectSubmission(id, adminEmail, reason);
			count++;
		} catch {}
	}
	return { success: true, affectedCount: count };
}

/**
 * Bulk publish multiple submissions
 */
export async function bulkPublishSubmissions(
	ids: string[],
	adminEmail: string,
): Promise<{ success: boolean; affectedCount: number }> {
	let count = 0;
	for (const id of ids) {
		try {
			await publishSubmission(id, adminEmail);
			count++;
		} catch {}
	}
	return { success: true, affectedCount: count };
}

/**
 * Bulk delete multiple submissions
 */
export async function bulkDeleteSubmissions(
	ids: string[],
	adminEmail: string,
): Promise<{ success: boolean; affectedCount: number }> {
	let count = 0;
	for (const id of ids) {
		try {
			await deleteSubmission(id, adminEmail);
			count++;
		} catch {}
	}
	return { success: true, affectedCount: count };
}
