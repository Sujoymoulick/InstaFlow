import type { APIRoute } from 'astro';
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '../../../db/index.js';
import { processWebhookEvent, type WebhookIncomingEvent } from '../../../services/automation-engine.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const secret = process.env.CRON_SECRET;
	if (!secret || secret.length < 32) return new Response('CRON_SECRET is not configured.', { status: 503 });
	if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });

	const db = getDb();
	if (!db) return new Response('DATABASE_URL is not configured.', { status: 503 });

	try {
		// Recover jobs whose worker stopped before it entered the external send stage.
		const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
		await db.update(schema.webhookEvents)
			.set({ status: 'pending', processingStartedAt: null })
			.where(and(eq(schema.webhookEvents.status, 'processing'), lt(schema.webhookEvents.processingStartedAt, staleBefore), lt(schema.webhookEvents.attemptCount, 5)));
		await db.update(schema.webhookEvents)
			.set({ status: 'failed', errorMessage: 'Processing attempts exhausted before delivery.', processedAt: new Date() })
			.where(and(eq(schema.webhookEvents.status, 'processing'), lt(schema.webhookEvents.processingStartedAt, staleBefore), sql`${schema.webhookEvents.attemptCount} >= 5`));

		const pending = await db.select().from(schema.webhookEvents)
			.where(and(eq(schema.webhookEvents.status, 'pending'), lt(schema.webhookEvents.attemptCount, 5)))
			.orderBy(schema.webhookEvents.createdAt)
			.limit(10);

		let claimedCount = 0;
		for (const row of pending) {
			const [claimed] = await db.update(schema.webhookEvents)
				.set({ status: 'processing', processingStartedAt: new Date(), attemptCount: sql`${schema.webhookEvents.attemptCount} + 1` })
				.where(and(eq(schema.webhookEvents.id, row.id), eq(schema.webhookEvents.status, 'pending')))
				.returning({ id: schema.webhookEvents.id });
			if (!claimed) continue;
			claimedCount += 1;

			const payload = row.rawPayload as { queuedEvent?: WebhookIncomingEvent };
			if (!payload?.queuedEvent) {
				await db.update(schema.webhookEvents).set({ status: 'failed', errorMessage: 'Queued event payload is invalid.', processedAt: new Date() }).where(eq(schema.webhookEvents.id, row.id));
				continue;
			}
			await processWebhookEvent(payload.queuedEvent, row.id);
		}

		return new Response(JSON.stringify({ success: true, claimed: claimedCount }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('[Instagram queue worker] Processing failed:', error instanceof Error ? error.message : 'unknown error');
		return new Response(JSON.stringify({ error: 'Instagram queue processing failed.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};

export const GET = get;
