/**
 * ClickForNothing Analytics Service
 * Computes category distributions, submission velocity, and moderation statistics.
 */

import { getSubmissionStats, listSubmissions } from './submissions.js';

export interface CfnAnalyticsSummary {
	totalSubmissions: number;
	pendingReview: number;
	approved: number;
	published: number;
	rejected: number;
	totalCreators: number;
	approvalRatePercent: number;
	categoryBreakdown: Array<{ category: string; count: number; percentage: number }>;
	statusBreakdown: Array<{ status: string; count: number; color: string }>;
	recentVelocity: Array<{ date: string; submissions: number; approved: number; published: number }>;
	lastUpdated: string;
}

export async function getCfnAnalyticsSummary(): Promise<CfnAnalyticsSummary> {
	const [stats, listRes] = await Promise.all([
		getSubmissionStats(),
		listSubmissions({ limit: 100 }),
	]);

	const total = Math.max(stats.totalSubmissions, 1);
	const resolved = stats.approved + stats.published + stats.rejected;
	const approvedTotal = stats.approved + stats.published;
	const approvalRatePercent = resolved > 0 ? Math.round((approvedTotal / resolved) * 100) : 100;

	// Category aggregation
	const catMap = new Map<string, number>();
	for (const sub of listRes.submissions) {
		const cat = sub.category || 'General';
		catMap.set(cat, (catMap.get(cat) || 0) + 1);
	}

	const categoryBreakdown = Array.from(catMap.entries()).map(([category, count]) => ({
		category,
		count,
		percentage: Math.round((count / listRes.submissions.length) * 100) || 0,
	})).sort((a, b) => b.count - a.count);

	const statusBreakdown = [
		{ status: 'Pending Review', count: stats.pendingReview, color: '#f59e0b' },
		{ status: 'Approved', count: stats.approved, color: '#0ea5e9' },
		{ status: 'Published', count: stats.published, color: '#10b981' },
		{ status: 'Rejected', count: stats.rejected, color: '#f43f5e' },
	];

	// Recent velocity (past 7 days)
	const recentVelocity: Array<{ date: string; submissions: number; approved: number; published: number }> = [];
	const now = new Date();
	for (let i = 6; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split('T')[0]!;

		const onDay = listRes.submissions.filter((s) => s.createdAt.startsWith(dateStr));
		recentVelocity.push({
			date: dateStr,
			submissions: onDay.length,
			approved: onDay.filter((s) => s.status === 'Approved').length,
			published: onDay.filter((s) => s.status === 'Published').length,
		});
	}

	return {
		totalSubmissions: stats.totalSubmissions,
		pendingReview: stats.pendingReview,
		approved: stats.approved,
		published: stats.published,
		rejected: stats.rejected,
		totalCreators: stats.totalUsers,
		approvalRatePercent,
		categoryBreakdown,
		statusBreakdown,
		recentVelocity,
		lastUpdated: new Date().toISOString(),
	};
}
