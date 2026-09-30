import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../../lib/crypto.js';
import { processWebhookEvent, type WebhookIncomingEvent } from '../../../services/automation-engine.js';

export const prerender = false;

/**
 * Meta Webhook Verification Challenge (GET)
 */
export const get: APIRoute = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

	if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
		console.log('Instagram Webhook verified successfully');
		return new Response(challenge || '', {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	console.warn('Instagram Webhook verification failed: token mismatch or missing mode');
	return new Response('Forbidden', { status: 403 });
};

export const GET = get;

/**
 * Meta Webhook Event Ingestion (POST)
 */
export const post: APIRoute = async ({ request }) => {
	try {
		const rawBody = await request.text();
		const signature = request.headers.get('x-hub-signature-256');

		// Webhook signature verification
		if (process.env.META_APP_SECRET) {
			const isValid = verifyWebhookSignature(rawBody, signature, process.env.META_APP_SECRET);
			if (!isValid) {
				console.warn('Instagram Webhook signature verification failed');
				return new Response('Invalid signature', { status: 401 });
			}
		}

		let body: any;
		try {
			body = JSON.parse(rawBody);
		} catch (e) {
			return new Response('Invalid JSON', { status: 400 });
		}

		// Verify object is instagram or page
		if (body.object !== 'instagram' && body.object !== 'page') {
			return new Response('Ignored object', { status: 200 });
		}

		const entries = Array.isArray(body.entry) ? body.entry : [];
		const processingPromises: Promise<any>[] = [];

		for (const entry of entries) {
			// A. Incoming Direct Messages (`messaging` field)
			if (entry.messaging && Array.isArray(entry.messaging)) {
				for (const msgItem of entry.messaging) {
					if (msgItem.message && msgItem.message.text) {
						// Ignore echo messages (messages sent by the page/account itself)
						if (msgItem.message.is_echo) continue;

						const event: WebhookIncomingEvent = {
							eventId: msgItem.message.mid || `mid_${msgItem.sender.id}_${msgItem.timestamp}`,
							eventType: 'message',
							senderId: msgItem.sender.id,
							recipientId: msgItem.recipient?.id,
							text: msgItem.message.text,
							rawPayload: msgItem,
						};

						processingPromises.push(processWebhookEvent(event));
					}
				}
			}

			// B. Incoming Comments (`changes` field)
			if (entry.changes && Array.isArray(entry.changes)) {
				for (const change of entry.changes) {
					if (change.field === 'comments' && change.value) {
						const val = change.value;
						if (val.text && val.id) {
							const event: WebhookIncomingEvent = {
								eventId: `comment_${val.id}`,
								eventType: 'comment',
								senderId: val.from?.id || 'unknown',
								commentId: val.id,
								text: val.text,
								rawPayload: change,
							};

							processingPromises.push(processWebhookEvent(event));
						}
					}
				}
			}
		}

		// Await all events to ensure serverless functions don't terminate before DB writes
		await Promise.all(processingPromises);

		return new Response(JSON.stringify({ status: 'EVENT_RECEIVED' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('Unhandled webhook error:', error);
		// Return 200 or 500: return 200 to prevent Meta retry storm unless critical
		return new Response(JSON.stringify({ error: error.message }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST = post;
