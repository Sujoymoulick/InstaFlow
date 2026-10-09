/**
 * SendVirtualGift Unified Database Diagnostic Service
 * Monitors and probes InsForge PostgreSQL BaaS and Neon Transactional PostgreSQL.
 * SECURITY: NEVER exposes raw passwords, tokens, or unmasked connection URLs.
 */

import { getNeonSql, isNeonConfigured, getNeonDatabaseUrl, getInsForgeClient, isInsForgeConfigured, getInsForgeConfig } from './clients.js';

export interface DatabaseHealthInfo {
	id: string;
	name: string;
	role: string;
	provider: string;
	status: 'connected' | 'degraded' | 'disconnected';
	latencyMs: number;
	maskedEndpoint: string;
	branch?: string;
	version?: string;
	sslEnabled: boolean;
	tables: Record<string, number>;
	lastChecked: string;
	error?: string;
}

export interface UnifiedDatabasesReport {
	insforge: DatabaseHealthInfo;
	neon: DatabaseHealthInfo;
	lastUpdated: string;
}

export async function getSvgDatabasesHealth(): Promise<UnifiedDatabasesReport> {
	const now = new Date().toISOString();

	// 1. Probe InsForge PostgreSQL
	const insforgeReport: DatabaseHealthInfo = {
		id: 'insforge',
		name: 'InsForge PostgreSQL (BaaS)',
		role: 'Main application database: User profiles, saved cards, likes & analytics event stream',
		provider: 'InsForge Serverless BaaS',
		status: 'disconnected',
		latencyMs: 0,
		maskedEndpoint: 'https://at8vrkks.us-east.insforge.app',
		sslEnabled: true,
		tables: {
			users: 0,
			saved_cards: 0,
			card_likes: 0,
			analytics_events: 0,
			gifts: 0,
			no_signup_counters: 0,
			system_settings: 0,
		},
		lastChecked: now,
	};

	if (isInsForgeConfigured()) {
		const { baseUrl } = getInsForgeConfig();
		insforgeReport.maskedEndpoint = baseUrl ? maskUrl(baseUrl) : 'https://at8vrkks.us-east.insforge.app';
		const start = performance.now();
		try {
			const insforge = getInsForgeClient();
			const [usersRes, savedRes, likesRes, eventsRes, giftsRes, countersRes] = await Promise.all([
				insforge.database.from('users').select('id', { count: 'exact' }),
				insforge.database.from('saved_cards').select('id', { count: 'exact' }),
				insforge.database.from('card_likes').select('id', { count: 'exact' }),
				insforge.database.from('analytics_events').select('id', { count: 'exact' }),
				insforge.database.from('gifts').select('id', { count: 'exact' }),
				insforge.database.from('no_signup_counters').select('*', { count: 'exact' }),
			]);

			insforgeReport.latencyMs = Math.round(performance.now() - start);
			insforgeReport.status = 'connected';
			insforgeReport.version = 'PostgreSQL 16.3 (InsForge BaaS)';
			insforgeReport.tables = {
				users: usersRes?.count ?? (usersRes?.data?.length || 0),
				saved_cards: savedRes?.count ?? (savedRes?.data?.length || 0),
				card_likes: likesRes?.count ?? (likesRes?.data?.length || 0),
				analytics_events: eventsRes?.count ?? (eventsRes?.data?.length || 0),
				gifts: giftsRes?.count ?? (giftsRes?.data?.length || 0),
				no_signup_counters: countersRes?.count ?? (countersRes?.data?.length || 2),
				system_settings: 0,
			};
		} catch (e: any) {
			insforgeReport.latencyMs = Math.round(performance.now() - start);
			insforgeReport.status = 'degraded';
			insforgeReport.error = e.message;
		}
	} else {
		insforgeReport.error = 'InsForge URL or Anon Key not configured.';
	}

	// 2. Probe Neon PostgreSQL
	const neonReport: DatabaseHealthInfo = {
		id: 'neon',
		name: 'Neon PostgreSQL (Lakebase)',
		role: 'Paid rose orders, payment signatures, entitlements, paid card cloud backups',
		provider: 'Neon Serverless PostgreSQL (Databricks / Lakebase)',
		status: 'disconnected',
		latencyMs: 0,
		maskedEndpoint: 'ep-silent-hill-***.neon.tech',
		branch: process.env.NEON_BRANCH || 'main',
		sslEnabled: true,
		tables: {
			rose_orders: 0,
			rose_purchase_entitlements: 0,
			rose_payment_events: 0,
			rose_card_backups: 0,
		},
		lastChecked: now,
	};

	if (isNeonConfigured()) {
		const rawUrl = getNeonDatabaseUrl();
		neonReport.maskedEndpoint = maskDbUrl(rawUrl);
		const start = performance.now();
		try {
			const sql = getNeonSql();
			const [pingResult] = await sql`SELECT 1 as num, version() as ver, NOW() as server_time`;
			const [ordersCount] = await sql`SELECT COUNT(*)::int as c FROM rose_orders`;
			const [entitlementsCount] = await sql`SELECT COUNT(*)::int as c FROM rose_purchase_entitlements`;
			const [eventsCount] = await sql`SELECT COUNT(*)::int as c FROM rose_payment_events`;
			const [backupsCount] = await sql`SELECT COUNT(*)::int as c FROM rose_card_backups`;

			neonReport.latencyMs = Math.round(performance.now() - start);
			neonReport.status = 'connected';
			neonReport.version = pingResult?.ver ? String(pingResult.ver).split(' on ')[0] : 'PostgreSQL 16 (Neon Serverless)';
			neonReport.tables = {
				rose_orders: ordersCount?.c ?? 0,
				rose_purchase_entitlements: entitlementsCount?.c ?? 0,
				rose_payment_events: eventsCount?.c ?? 0,
				rose_card_backups: backupsCount?.c ?? 0,
			};
		} catch (e: any) {
			neonReport.latencyMs = Math.round(performance.now() - start);
			neonReport.status = 'degraded';
			neonReport.error = e.message;
		}
	} else {
		neonReport.error = 'NEON_DATABASE_URL or DATABASE_URL not configured.';
	}

	return {
		insforge: insforgeReport,
		neon: neonReport,
		lastUpdated: now,
	};
}

function maskUrl(urlStr: string): string {
	try {
		const u = new URL(urlStr);
		return `${u.protocol}//${u.host}`;
	} catch {
		return 'https://***.insforge.app';
	}
}

function maskDbUrl(urlStr: string): string {
	try {
		const u = new URL(urlStr);
		return `postgresql://***:***@${u.host}${u.pathname}?sslmode=require`;
	} catch {
		return 'postgresql://***:***@ep-silent-hill-***.neon.tech/neondb';
	}
}
