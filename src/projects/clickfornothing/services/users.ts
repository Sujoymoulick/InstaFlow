/**
 * ClickForNothing User Directory Service
 * Merges Clerk authenticated users with website submitters from Neon database.
 */

import { fetchCfnClerkUsers } from './clients.js';
import type { ClickForNothingUser } from '../types.js';
import { listSubmissions } from './submissions.js';

export async function listClickForNothingUsers(): Promise<ClickForNothingUser[]> {
	const userMap = new Map<string, ClickForNothingUser>();

	// 1. Aggregate from database website submissions
	const submissionsData = await listSubmissions({ limit: 100 });
	for (const sub of submissionsData.submissions) {
		const existing = userMap.get(sub.userId) || {
			userId: sub.userId,
			name: sub.userName || 'Creator',
			email: sub.userEmail || 'unknown@user.com',
			avatarUrl: sub.userAvatarUrl,
			verified: true,
			totalSubmissions: 0,
			pendingCount: 0,
			approvedCount: 0,
			publishedCount: 0,
			rejectedCount: 0,
			firstSubmittedAt: sub.createdAt,
			lastSubmittedAt: sub.createdAt,
		};

		existing.totalSubmissions++;
		if (sub.status === 'Pending Review') existing.pendingCount++;
		else if (sub.status === 'Approved') existing.approvedCount++;
		else if (sub.status === 'Published') existing.publishedCount++;
		else if (sub.status === 'Rejected') existing.rejectedCount++;

		if (new Date(sub.createdAt).getTime() > new Date(existing.lastSubmittedAt || 0).getTime()) {
			existing.lastSubmittedAt = sub.createdAt;
		}

		userMap.set(sub.userId, existing);
	}

	// 2. Fetch authenticated Clerk users to supplement profile details
	try {
		const clerkResult = await fetchCfnClerkUsers({ limit: 100 });
		for (const u of clerkResult.users) {
			const existing = userMap.get(u.id);
			const displayName =
				[u.firstName, u.lastName].filter(Boolean).join(' ') ||
				u.username ||
				u.email.split('@')[0] ||
				'Clerk User';

			if (existing) {
				existing.name = displayName;
				existing.email = u.email || existing.email;
				existing.avatarUrl = u.imageUrl || existing.avatarUrl;
				existing.verified = true;
			} else {
				// User registered via Clerk
				userMap.set(u.id, {
					userId: u.id,
					name: displayName,
					email: u.email || 'no-email@clerk.dev',
					avatarUrl: u.imageUrl,
					verified: true,
					totalSubmissions: 0,
					pendingCount: 0,
					approvedCount: 0,
					publishedCount: 0,
					rejectedCount: 0,
					firstSubmittedAt: null,
					lastSubmittedAt: null,
				});
			}
		}
	} catch (clerkErr) {
		console.warn('[ClickForNothing Users] Clerk users fetch skipped:', clerkErr);
	}

	return Array.from(userMap.values()).sort((a, b) => b.totalSubmissions - a.totalSubmissions);
}
