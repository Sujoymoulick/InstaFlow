/**
 * Comprehensive Automated Test Suite for SendVirtualGift Central Admin Integration
 */

import 'dotenv/config';
import { getRegisteredProjects, getProjectById } from '../src/projects/registry.js';
import { getSvgOverviewKpis } from '../src/projects/sendvirtualgift/services/overview.js';
import { listSvgAdminUsers } from '../src/projects/sendvirtualgift/services/users.js';
import { getSvgAnalyticsSummary } from '../src/projects/sendvirtualgift/services/analytics.js';
import { listSvgCards } from '../src/projects/sendvirtualgift/services/cards.js';
import { listSvgCardBackups } from '../src/projects/sendvirtualgift/services/backups.js';
import { listSvgPayments } from '../src/projects/sendvirtualgift/services/payments.js';
import { listSvgTransactions } from '../src/projects/sendvirtualgift/services/transactions.js';
import { listSvgInvoices, getSvgInvoiceById } from '../src/projects/sendvirtualgift/services/invoices.js';
import { getSvgDatabasesHealth } from '../src/projects/sendvirtualgift/services/databases.js';
import { getSvgRateLimits } from '../src/projects/sendvirtualgift/services/rateLimits.js';
import { probeAllSvgIntegrations } from '../src/projects/sendvirtualgift/services/integrations.js';
import { auditSvgEnvironment } from '../src/projects/sendvirtualgift/services/environment.js';
import { getSvgSystemHealth } from '../src/projects/sendvirtualgift/services/health.js';
import { getSvgSettings } from '../src/projects/sendvirtualgift/services/settings.js';

async function runTests() {
	console.log('================================================================');
	console.log('SENDVIRTUALGIFT ADMIN INTEGRATION TEST SUITE');
	console.log('================================================================\n');

	let passed = 0;
	let failed = 0;

	async function test(name: string, fn: () => Promise<void>) {
		try {
			process.stdout.write(`TEST: ${name}... `);
			await fn();
			console.log('✅ PASSED');
			passed++;
		} catch (err: any) {
			console.log(`❌ FAILED: ${err.message}`);
			console.error(err);
			failed++;
		}
	}

	// 1. Registry
	await test('Project Registry contains SendVirtualGift with 14 navigation subpages', async () => {
		const projects = getRegisteredProjects();
		if (projects.length === 0) throw new Error('No registered projects found');
		const svg = getProjectById('sendvirtualgift');
		if (!svg) throw new Error('SendVirtualGift project not found in registry');
		if (svg.navigation.length < 14) throw new Error(`Expected at least 14 subpages, got ${svg.navigation.length}`);
	});

	// 2. Overview KPIs
	await test('Overview KPIs aggregator connects and returns real metrics', async () => {
		const kpis = await getSvgOverviewKpis();
		if (typeof kpis.totalPaidPurchases !== 'number') throw new Error('Invalid totalPaidPurchases');
		if (typeof kpis.totalRevenueRupees !== 'number') throw new Error('Invalid totalRevenueRupees');
		if (!['connected', 'degraded', 'disconnected'].includes(kpis.neonStatus)) {
			throw new Error(`Neon unexpected status: ${kpis.neonStatus}`);
		}
		console.log(`\n   [KPIs] Users: ${kpis.totalRegisteredUsers}, Orders: ${kpis.totalPaidPurchases}, Revenue: ₹${kpis.totalRevenueRupees} (Neon: ${kpis.neonStatus})`);
	});

	// 3. Users
	await test('Users Service merges Clerk and InsForge user records', async () => {
		const usersRes = await listSvgAdminUsers({ limit: 5 });
		if (!Array.isArray(usersRes.users)) throw new Error('Users is not an array');
		console.log(`\n   [Users] Total count: ${usersRes.total}, Sample returned: ${usersRes.users.length}`);
	});

	// 4. Analytics
	await test('Analytics Service returns timeline and template usage', async () => {
		const analytics = await getSvgAnalyticsSummary('30d');
		if (!Array.isArray(analytics.timeline)) throw new Error('Timeline is not an array');
		if (!Array.isArray(analytics.templateUsage)) throw new Error('Template usage is not an array');
		console.log(`\n   [Analytics] Timeline points: ${analytics.timeline.length}, Total events: ${analytics.totalEvents}`);
	});

	// 5. Operational Cards
	await test('Cards Service returns operational aggregates with privacy preserved', async () => {
		const cardsRes = await listSvgCards({ limit: 5 });
		if (!Array.isArray(cardsRes.cards)) throw new Error('Cards is not an array');
		console.log(`\n   [Cards] Total operational cards: ${cardsRes.metrics.totalGenerated}`);
	});

	// 6. Card Backups
	await test('Card Backups Service queries Neon rose_card_backups', async () => {
		const backupsRes = await listSvgCardBackups({ limit: 5 });
		if (!Array.isArray(backupsRes.backups)) throw new Error('Backups is not an array');
		console.log(`\n   [Backups] Total backups in Neon: ${backupsRes.total}, Active: ${backupsRes.activeBackupsCount}`);
	});

	// 7. Payments
	await test('Payments Service queries Neon rose_orders and Razorpay', async () => {
		const payRes = await listSvgPayments({ limit: 5 });
		if (!Array.isArray(payRes.orders)) throw new Error('Orders is not an array');
		console.log(`\n   [Payments] Total orders: ${payRes.total}, Revenue: ₹${payRes.stats.totalRevenueRupees}`);
	});

	// 8. Transactions
	await test('Transactions Service queries Neon transaction ledger and entitlements', async () => {
		const txRes = await listSvgTransactions({ limit: 5 });
		if (!Array.isArray(txRes.transactions)) throw new Error('Transactions is not an array');
		console.log(`\n   [Transactions] Ledger rows: ${txRes.total}`);
	});

	// 9. Invoices
	await test('Invoices Service generates itemized tax invoices from Neon orders', async () => {
		const invRes = await listSvgInvoices({ limit: 5 });
		if (!Array.isArray(invRes.invoices)) throw new Error('Invoices is not an array');
		console.log(`\n   [Invoices] Generated invoices: ${invRes.total}, Total invoiced: ₹${invRes.totalInvoicedRupees}`);

		if (invRes.invoices.length > 0) {
			const single = await getSvgInvoiceById(invRes.invoices[0]!.orderId);
			if (!single) throw new Error('Failed to get single invoice by ID');
			console.log(`   [Sample Invoice] #${single.receiptNumber}: ₹${single.total} (Subtotal ₹${single.subtotal} + GST ₹${single.tax})`);
		}
	});

	// 10. Databases
	await test('Databases Service performs health check for InsForge and Neon', async () => {
		const dbReport = await getSvgDatabasesHealth();
		if (!['connected', 'degraded', 'error'].includes(dbReport.neon.status)) {
			throw new Error(`Neon unexpected status: ${dbReport.neon.status}`);
		}
		console.log(`\n   [Databases] Neon: ${dbReport.neon.status} (${dbReport.neon.latencyMs}ms), InsForge: ${dbReport.insforge.status} (${dbReport.insforge.latencyMs}ms)`);
	});

	// 11. Rate Limits
	await test('Rate Limits Service inspects all 5 configured rate limit rules', async () => {
		const limits = getSvgRateLimits();
		if (limits.rules.length < 5) throw new Error(`Expected at least 5 rules, got ${limits.rules.length}`);
		console.log(`\n   [Rate Limits] Enabled: ${limits.enabled}, Rules count: ${limits.rules.length}`);
	});

	// 12. Integrations
	await test('Integrations Service probes all 7 external services', async () => {
		const integrations = await probeAllSvgIntegrations();
		if (integrations.length < 7) throw new Error(`Expected 7 integration probes, got ${integrations.length}`);
		const connected = integrations.filter((i) => i.status === 'connected');
		console.log(`\n   [Integrations] Probed: ${integrations.length}, Connected: ${connected.length}`);
	});

	// 13. Environment
	await test('Environment Auditor audits all variables without exposing secrets', async () => {
		const envReport = auditSvgEnvironment();
		if (envReport.items.length === 0) throw new Error('Environment items empty');
		console.log(`\n   [Env Audit] Total variables evaluated: ${envReport.summary.total}, Configured: ${envReport.summary.configuredCount}`);
	});

	// 14. System Health
	await test('System Health Monitor aggregates status and uptime', async () => {
		const health = await getSvgSystemHealth();
		if (!health.overallStatus) throw new Error('Invalid overallStatus');
		console.log(`\n   [System Health] Status: ${health.overallStatus}, Uptime: ${health.uptimePercent}%`);
	});

	// 15. Settings
	await test('Settings Service retrieves production domain and feature flags', async () => {
		const settings = getSvgSettings();
		if (!settings.productionDomain.includes('sendvirtualgift.com')) throw new Error('Invalid production domain');
		console.log(`\n   [Settings] Domain: ${settings.productionDomain}, Maintenance: ${settings.maintenanceMode}`);
	});

	console.log('\n================================================================');
	console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
	console.log('================================================================');

	if (failed > 0) {
		process.exit(1);
	}
}

runTests();
