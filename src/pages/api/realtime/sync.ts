import type { APIRoute } from 'astro';
import { getDashboardMetrics, getRecentActivity, getAnalyticsData } from '../../../services/analytics.js';
import { getProjectMetrics, getProjects } from '../../../services/projects.js';
import { getActiveInstagramAccount } from '../../../services/instagram.js';
import { getDb, schema } from '../../../db/index.js';
import { count } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	try {
		const db = getDb();
		const [
			dashboardMetrics,
			recentActivity,
			projectMetrics,
			projects,
			activeAccount,
			analyticsData,
			rulesCountRes,
		] = await Promise.all([
			getDashboardMetrics(),
			getRecentActivity(10),
			getProjectMetrics(),
			getProjects(),
			getActiveInstagramAccount(),
			getAnalyticsData(),
			db ? db.select({ val: count() }).from(schema.automationRules) : Promise.resolve([{ val: 0 }]),
		]);

		const rulesCount = Number(rulesCountRes?.[0]?.val || 0);

		const deliveryAttempts = dashboardMetrics.successfulReplies + dashboardMetrics.failedReplies;
		const deliveryRate = deliveryAttempts > 0 ? Math.round((dashboardMetrics.successfulReplies / deliveryAttempts) * 100) : 0;

		const system = {
			database: {
				status: dashboardMetrics.dbConfigured ? 'connected' : 'disconnected',
				provider: 'Neon Serverless Postgres',
				branch: process.env.NEON_BRANCH || 'production',
			},
			meta: {
				configured: Boolean((process.env.META_IG_APP_ID || process.env.META_APP_ID) && (process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET)),
				appId: process.env.META_IG_APP_ID || process.env.META_APP_ID || null,
				apiVersion: process.env.META_API_VERSION || 'v26.0',
				webhookVerifyTokenSet: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
				redirectUri: process.env.META_REDIRECT_URI || null,
			},
			instagram: {
				connected: Boolean(activeAccount),
				username: activeAccount?.username || null,
				status: activeAccount?.status || 'disconnected',
				tokenExpiresAt: activeAccount?.tokenExpiresAt || null,
			},
			storage: {
				configured: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ENDPOINT_URL_S3),
				endpoint: process.env.AWS_ENDPOINT_URL_S3 || null,
				region: process.env.AWS_REGION || 'us-east-2',
			},
			admin: {
				allowedEmail: process.env.ALLOWED_ADMIN_EMAIL || 'lifeunderzero777@gmail.com',
			},
			timestamp: new Date().toISOString(),
		};

		return new Response(
			JSON.stringify({
				success: true,
				system,
				metrics: {
					...dashboardMetrics,
					deliveryRate,
					projectMetrics,
				},
				recentActivity,
				projects,
				analytics: analyticsData,
				rulesCount,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			},
		);
	} catch (error: any) {
		console.error('Realtime sync endpoint error:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error.message || 'Failed to fetch realtime data',
				timestamp: new Date().toISOString(),
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			},
		);
	}
};

export const GET = get;
