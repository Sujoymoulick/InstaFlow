/**
 * ClickForNothing Database Diagnostics & Health Service
 * Provides detailed PostgreSQL metrics, table row counts, and latency diagnostics.
 */

import {
	getCfnDatabaseUrl,
	getCfnDatabaseUrlUnpooled,
	getCfnSql,
	isCfnDatabaseConfigured,
} from './clients.js';

export interface CfnDatabaseProbeResult {
	id: string;
	name: string;
	type: 'neon-pooled' | 'neon-direct';
	endpoint: string;
	status: 'connected' | 'degraded' | 'disconnected' | 'unconfigured';
	latencyMs: number | null;
	activeConnections?: number;
	tableStats: Array<{
		tableName: string;
		rowCount: number;
		sizeBytes?: number;
		lastActivity?: string | null;
	}>;
	systemInfo?: {
		version: string;
		database: string;
		currentTime: string;
		branch: string;
	};
	errorMessage?: string;
	lastChecked: string;
}

export async function probeCfnDatabases(): Promise<CfnDatabaseProbeResult[]> {
	const results: CfnDatabaseProbeResult[] = [];
	const configured = isCfnDatabaseConfigured();

	if (!configured) {
		return [
			{
				id: 'cfn-neon-pooled',
				name: 'ClickForNothing Neon Pooler',
				type: 'neon-pooled',
				endpoint: 'Not Configured',
				status: 'unconfigured',
				latencyMs: null,
				tableStats: [],
				lastChecked: new Date().toISOString(),
				errorMessage: 'CLICKFORNOTHING_DATABASE_URL environment variable is missing',
			},
		];
	}

	const pooledUrl = getCfnDatabaseUrl();
	const unpooledUrl = getCfnDatabaseUrlUnpooled();

	// 1. Probe Pooled Connection
	const startPooled = performance.now();
	try {
		const sql = getCfnSql();
		const [sysRows, tableRows, subCountRows, auditCountRows] = await Promise.all([
			sql`SELECT current_database() as db, version() as ver, NOW() as time;`,
			sql`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = 'public' 
				ORDER BY table_name;
			`,
			sql`SELECT count(*) as count FROM website_submissions;`.catch(() => [{ count: 0 }]),
			sql`SELECT count(*) as count FROM submission_audit_logs;`.catch(() => [{ count: 0 }]),
		]);

		const latencyMs = Math.round(performance.now() - startPooled);

		const tableStats = (tableRows as any[]).map((r) => {
			const tableName = r.table_name;
			let rowCount = 0;
			if (tableName === 'website_submissions') rowCount = Number(subCountRows[0]?.count || 0);
			if (tableName === 'submission_audit_logs') rowCount = Number(auditCountRows[0]?.count || 0);
			return {
				tableName,
				rowCount,
			};
		});

		let endpointMasked = 'ep-frosty-scene-b4awman7-pooler.c-6.us-east-2.aws.neon.tech';
		try {
			endpointMasked = new URL(pooledUrl).host;
		} catch {}

		results.push({
			id: 'cfn-neon-pooled',
			name: 'ClickForNothing Neon PostgreSQL (Connection Pooler)',
			type: 'neon-pooled',
			endpoint: endpointMasked,
			status: 'connected',
			latencyMs,
			tableStats,
			systemInfo: {
				database: sysRows[0]?.db || 'neondb',
				version: sysRows[0]?.ver || 'PostgreSQL 18.6',
				currentTime: String(sysRows[0]?.time || new Date().toISOString()),
				branch: 'main',
			},
			lastChecked: new Date().toISOString(),
		});
	} catch (err: any) {
		results.push({
			id: 'cfn-neon-pooled',
			name: 'ClickForNothing Neon PostgreSQL (Connection Pooler)',
			type: 'neon-pooled',
			endpoint: 'ep-frosty-scene-b4awman7-pooler.c-6.us-east-2.aws.neon.tech',
			status: 'disconnected',
			latencyMs: Math.round(performance.now() - startPooled),
			tableStats: [],
			errorMessage: err.message || 'Failed to query Neon pooled connection',
			lastChecked: new Date().toISOString(),
		});
	}

	return results;
}
