import { getDb, schema } from '../db/index.js';
import { count, eq, sql, desc, gte } from 'drizzle-orm';

export interface DashboardMetrics {
	totalEvents: number;
	successfulReplies: number;
	failedReplies: number;
	activeRules: number;
	instagramConnected: boolean;
	instagramUsername: string | null;
	dbConfigured: boolean;
}

export interface ActivityItem {
	id: string;
	eventType: string;
	matchedKeyword: string | null;
	ruleName: string | null;
	senderId: string;
	incomingText: string | null;
	sentReplyText: string | null;
	status: string;
	errorDetails: string | null;
	createdAt: Date;
}

export interface AnalyticsData {
	totalEvents: number;
	successRate: number;
	successfulReplies: number;
	failedReplies: number;
	skippedEvents: number;
	activeRulesCount: number;
	triggerTypeDistribution: { type: string; count: number }[];
	dailyActivity: { date: string; sent: number; failed: number }[];
	topRules: { ruleName: string; count: number }[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
	const db = getDb();
	if (!db) {
		return {
			totalEvents: 0,
			successfulReplies: 0,
			failedReplies: 0,
			activeRules: 0,
			instagramConnected: false,
			instagramUsername: null,
			dbConfigured: false,
		};
	}

	try {
		const [eventsCount] = await db.select({ val: count() }).from(schema.webhookEvents);
		const [successCount] = await db
			.select({ val: count() })
			.from(schema.messageLogs)
			.where(eq(schema.messageLogs.status, 'sent'));
		const [failCount] = await db
			.select({ val: count() })
			.from(schema.messageLogs)
			.where(eq(schema.messageLogs.status, 'failed'));
		const [activeRulesCount] = await db
			.select({ val: count() })
			.from(schema.automationRules)
			.where(eq(schema.automationRules.isActive, true));

		const connectedAccounts = await db
			.select({ username: schema.instagramAccounts.username })
			.from(schema.instagramAccounts)
			.where(eq(schema.instagramAccounts.status, 'connected'))
			.limit(1);

		return {
			totalEvents: eventsCount?.val || 0,
			successfulReplies: successCount?.val || 0,
			failedReplies: failCount?.val || 0,
			activeRules: activeRulesCount?.val || 0,
			instagramConnected: connectedAccounts.length > 0,
			instagramUsername: connectedAccounts[0]?.username || null,
			dbConfigured: true,
		};
	} catch (error) {
		console.error('Error fetching dashboard metrics:', error);
		return {
			totalEvents: 0,
			successfulReplies: 0,
			failedReplies: 0,
			activeRules: 0,
			instagramConnected: false,
			instagramUsername: null,
			dbConfigured: false,
		};
	}
}

export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
	const db = getDb();
	if (!db) return [];

	try {
		const logs = await db
			.select({
				id: schema.messageLogs.id,
				eventType: schema.messageLogs.triggerType,
				matchedKeyword: schema.messageLogs.matchedKeyword,
				ruleName: schema.messageLogs.ruleName,
				senderId: schema.messageLogs.senderId,
				incomingText: schema.messageLogs.incomingText,
				sentReplyText: schema.messageLogs.sentReplyText,
				status: schema.messageLogs.status,
				errorDetails: schema.messageLogs.errorDetails,
				createdAt: schema.messageLogs.createdAt,
			})
			.from(schema.messageLogs)
			.orderBy(desc(schema.messageLogs.createdAt))
			.limit(limit);

		return logs;
	} catch (error) {
		console.error('Error fetching recent activity:', error);
		return [];
	}
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
	const db = getDb();
	if (!db) {
		return {
			totalEvents: 0,
			successRate: 0,
			successfulReplies: 0,
			failedReplies: 0,
			skippedEvents: 0,
			activeRulesCount: 0,
			triggerTypeDistribution: [],
			dailyActivity: [],
			topRules: [],
		};
	}

	try {
		const [eventsRes] = await db.select({ val: count() }).from(schema.webhookEvents);
		const [successRes] = await db
			.select({ val: count() })
			.from(schema.messageLogs)
			.where(eq(schema.messageLogs.status, 'sent'));
		const [failRes] = await db
			.select({ val: count() })
			.from(schema.messageLogs)
			.where(eq(schema.messageLogs.status, 'failed'));
		const [skippedRes] = await db
			.select({ val: count() })
			.from(schema.messageLogs)
			.where(eq(schema.messageLogs.status, 'skipped'));
		const [rulesRes] = await db
			.select({ val: count() })
			.from(schema.automationRules)
			.where(eq(schema.automationRules.isActive, true));

		const total = (successRes?.val || 0) + (failRes?.val || 0);
		const successRate = total > 0 ? Math.round(((successRes?.val || 0) / total) * 100) : 100;

		// Distribution by trigger type
		const triggerRows = await db
			.select({
				type: schema.messageLogs.triggerType,
				count: count(),
			})
			.from(schema.messageLogs)
			.groupBy(schema.messageLogs.triggerType);

		// Top rules
		const topRuleRows = await db
			.select({
				ruleName: schema.messageLogs.ruleName,
				count: count(),
			})
			.from(schema.messageLogs)
			.where(sql`${schema.messageLogs.ruleName} IS NOT NULL`)
			.groupBy(schema.messageLogs.ruleName)
			.orderBy(desc(count()))
			.limit(5);

		// 7-day daily activity
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const dailyRows = await db
			.select({
				date: sql<string>`TO_CHAR(${schema.messageLogs.createdAt}, 'YYYY-MM-DD')`,
				status: schema.messageLogs.status,
				count: count(),
			})
			.from(schema.messageLogs)
			.where(gte(schema.messageLogs.createdAt, sevenDaysAgo))
			.groupBy(sql`TO_CHAR(${schema.messageLogs.createdAt}, 'YYYY-MM-DD')`, schema.messageLogs.status)
			.orderBy(sql`TO_CHAR(${schema.messageLogs.createdAt}, 'YYYY-MM-DD')`);

		// Group by date
		const dailyMap = new Map<string, { sent: number; failed: number }>();
		for (const row of dailyRows) {
			const existing = dailyMap.get(row.date) || { sent: 0, failed: 0 };
			if (row.status === 'sent') existing.sent += Number(row.count);
			if (row.status === 'failed') existing.failed += Number(row.count);
			dailyMap.set(row.date, existing);
		}

		const dailyActivity = Array.from(dailyMap.entries()).map(([date, counts]) => ({
			date,
			sent: counts.sent,
			failed: counts.failed,
		}));

		return {
			totalEvents: eventsRes?.val || 0,
			successRate,
			successfulReplies: successRes?.val || 0,
			failedReplies: failRes?.val || 0,
			skippedEvents: skippedRes?.val || 0,
			activeRulesCount: rulesRes?.val || 0,
			triggerTypeDistribution: triggerRows.map((r) => ({ type: r.type, count: Number(r.count) })),
			dailyActivity,
			topRules: topRuleRows.map((r) => ({ ruleName: r.ruleName || 'Unnamed', count: Number(r.count) })),
		};
	} catch (error) {
		console.error('Error fetching analytics:', error);
		return {
			totalEvents: 0,
			successRate: 0,
			successfulReplies: 0,
			failedReplies: 0,
			skippedEvents: 0,
			activeRulesCount: 0,
			triggerTypeDistribution: [],
			dailyActivity: [],
			topRules: [],
		};
	}
}
