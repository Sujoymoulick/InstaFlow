import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../../lib/crypto.js';
import { processWebhookEvent, type WebhookIncomingEvent } from '../../../services/automation-engine.js';

export const prerender = false;

/**
 * Pure verification logic for Meta Webhook subscription verification
 */
export function verifyMetaWebhookChallenge(
	mode: string | null,
	token: string | null,
	challenge: string | null,
	expectedToken?: string,
): { status: number; body: string; headers: Record<string, string> } {
	const validToken =
		expectedToken ||
		process.env.META_WEBHOOK_VERIFY_TOKEN ||
		(typeof import.meta !== 'undefined' && import.meta.env?.META_WEBHOOK_VERIFY_TOKEN);

	// Validate mode is 'subscribe', token matches configured secret, and challenge is present
	if (mode === 'subscribe' && token && validToken && token === validToken && challenge) {
		return {
			status: 200,
			body: challenge,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		};
	}

	return {
		status: 403,
		body: 'Forbidden',
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	};
}

/**
 * Meta Webhook Verification Endpoint (GET)
 * Handles the initial subscription challenge from Meta Developers / Instagram Graph API
 */
export const get: APIRoute = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	const result = verifyMetaWebhookChallenge(mode, token, challenge);

	if (result.status === 200) {
		console.log(`[Meta Webhook] GET verification succeeded with mode "${mode}"`);
	} else {
		console.warn(`[Meta Webhook] GET verification rejected (mode: "${mode}", token supplied: ${Boolean(token)})`);
	}

	return new Response(result.body, {
		status: result.status,
		headers: result.headers,
	});
};

export const GET = get;

/**
 * Meta Webhook Event Ingestion Endpoint (POST)
 * Receives real-time comments and direct messaging events
 */
export const post: APIRoute = async ({ request }) => {
	try {
		const rawBody = await request.text();
		const signature = request.headers.get('x-hub-signature-256');

		// Webhook signature verification (HMAC-SHA256)
		const possibleSecrets = [
			process.env.META_APP_SECRET,
			process.env.META_IG_APP_SECRET,
			process.env.META_FB_APP_SECRET,
			(typeof import.meta !== 'undefined' && import.meta.env?.META_APP_SECRET),
			(typeof import.meta !== 'undefined' && import.meta.env?.META_IG_APP_SECRET),
			(typeof import.meta !== 'undefined' && import.meta.env?.META_FB_APP_SECRET),
		].filter(Boolean) as string[];

		if (possibleSecrets.length > 0 && signature) {
			const isValid = possibleSecrets.some((sec) => verifyWebhookSignature(rawBody, signature, sec));
			if (!isValid) {
				console.warn('[Meta Webhook] POST rejected: invalid HMAC-SHA256 signature');
				return new Response('Invalid signature', {
					status: 401,
					headers: { 'Content-Type': 'text/plain' },
				});
			}
		}

		let body: any;
		try {
			body = JSON.parse(rawBody);
		} catch (e) {
			return new Response('Invalid JSON', {
				status: 400,
				headers: { 'Content-Type': 'text/plain' },
			});
		}

		// Verify object type is instagram or page
		if (body.object !== 'instagram' && body.object !== 'page') {
			return new Response('Ignored object', {
				status: 200,
				headers: { 'Content-Type': 'text/plain' },
			});
		}

		const entries = Array.isArray(body.entry) ? body.entry : [];
		const processingPromises: Promise<any>[] = [];

		for (const entry of entries) {
			// A. Incoming Direct Messages & Postbacks (`messaging` field)
			if (entry.messaging && Array.isArray(entry.messaging)) {
				for (const msgItem of entry.messaging) {
					// 1. Regular Direct Messages
					if (msgItem.message && msgItem.message.text) {
						if (msgItem.message.is_echo) continue;

						const event: WebhookIncomingEvent = {
							eventId: msgItem.message.mid || `mid_${msgItem.sender.id}_${msgItem.timestamp}`,
							eventType: 'message',
							senderId: msgItem.sender.id,
							recipientId: msgItem.recipient?.id,
							senderUsername: msgItem.sender?.username,
							text: msgItem.message.text,
							rawPayload: msgItem,
						};

						processingPromises.push(processWebhookEvent(event));
					}

					// 2. Messaging Postbacks (e.g. Get Started button / Quick Replies)
					if (msgItem.postback) {
						const event: WebhookIncomingEvent = {
							eventId: `postback_${msgItem.sender.id}_${msgItem.timestamp || Date.now()}`,
							eventType: 'messaging_postbacks',
							senderId: msgItem.sender.id,
							recipientId: msgItem.recipient?.id,
							text: msgItem.postback.title || msgItem.postback.payload || 'START',
							rawPayload: msgItem,
						};

						processingPromises.push(processWebhookEvent(event));
					}
				}
			}

			// B. Incoming Comments (`changes` field)
			if (entry.changes && Array.isArray(entry.changes)) {
				for (const change of entry.changes) {
					// Instagram 'comments' field
					if (change.field === 'comments' && change.value) {
						const val = change.value;
						if (val.text && val.id) {
							const mediaId = val.media?.id || val.post_id || val.media_id || change.value?.media_id;
							const senderUsername = val.from?.username;
							const senderName = val.from?.name;
							let firstName = senderName ? senderName.split(' ')[0] : senderUsername;

							const event: WebhookIncomingEvent = {
								eventId: `comment_${val.id}`,
								eventType: 'comment',
								senderId: val.from?.id || 'unknown',
								senderUsername,
								senderFirstName: firstName,
								commentId: val.id,
								mediaId: mediaId ? String(mediaId) : undefined,
								text: val.text,
								rawPayload: change,
							};

							processingPromises.push(processWebhookEvent(event));
						}
					}

					// Facebook Page 'feed' field (for comments on connected page/instagram posts)
					if (change.field === 'feed' && change.value) {
						const val = change.value;
						if (val.item === 'comment' && (val.message || val.text) && val.comment_id) {
							const mediaId = val.post_id || val.photo_id || val.video_id;
							const event: WebhookIncomingEvent = {
								eventId: `comment_${val.comment_id}`,
								eventType: 'comment',
								senderId: val.from?.id || 'unknown',
								senderUsername: val.from?.name,
								senderFirstName: val.from?.name ? val.from.name.split(' ')[0] : undefined,
								commentId: val.comment_id,
								mediaId: mediaId ? String(mediaId) : undefined,
								text: val.message || val.text,
								rawPayload: change,
							};

							processingPromises.push(processWebhookEvent(event));
						}
					}
				}
			}
		}

		// Await all events to ensure serverless execution completes database operations
		await Promise.all(processingPromises);

		return new Response(JSON.stringify({ status: 'EVENT_RECEIVED', processed: processingPromises.length }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('[Meta Webhook] Unhandled POST error:', error);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST = post;
