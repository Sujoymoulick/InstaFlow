import { getDb, schema } from '../db/index.js';
import { eq, desc, and } from 'drizzle-orm';
import { decryptToken, encryptToken } from '../lib/crypto.js';

export const META_API_VERSION = process.env.META_API_VERSION || 'v26.0';
const GRAPH_API_BASE = `https://graph.instagram.com/${META_API_VERSION}`;

function safeApiUrl(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.origin}${parsed.pathname}`;
	} catch {
		return 'Meta API request';
	}
}

export const INSTAGRAM_OAUTH_SCOPES = [
	'instagram_business_basic',
	'instagram_business_manage_messages',
	'instagram_business_manage_comments',
].join(',');

export interface InstagramOAuthConfig {
	appId: string;
	appSecret: string;
	redirectUri: string;
}

export function getOAuthConfig(): InstagramOAuthConfig {
	const appId = process.env.META_IG_APP_ID || process.env.META_APP_ID || '';
	const appSecret = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET || '';
	const redirectUri = process.env.META_REDIRECT_URI || '';
	return { appId, appSecret, redirectUri };
}

/**
 * Execute a fetch with exponential backoff for transient network or rate-limiting errors (429 / 5xx)
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
	let attempt = 0;
	let delay = 300;

	while (true) {
		try {
			attempt++;
			const response = await fetch(url, options);

			// Retry on rate limit (429) or server errors (500, 502, 503, 504)
			if ((response.status === 429 || (response.status >= 500 && response.status <= 504)) && attempt <= maxRetries) {
				console.warn(`[Meta API] Received status ${response.status} on ${safeApiUrl(url)}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
				continue;
			}

			return response;
		} catch (error: any) {
			if (attempt <= maxRetries) {
				console.warn(`[Meta API] Network fetch error on ${safeApiUrl(url)}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
				continue;
			}
			throw error;
		}
	}
}

/**
 * Build the official Meta OAuth authorization URL
 */
export function getMetaAuthorizationUrl(
	state: string,
	redirectUriOverride?: string,
	provider: 'instagram' | 'facebook' = 'instagram',
): string {
	const redirectUri = redirectUriOverride || process.env.META_REDIRECT_URI || '';
	
	if (provider === 'facebook') throw new Error('Facebook Login is not configured for this Instagram Login integration.');
	const igAppId = process.env.META_IG_APP_ID || process.env.META_APP_ID || '';
	if (!igAppId || !redirectUri) throw new Error('META_APP_ID and META_REDIRECT_URI must be configured.');
	const params = new URLSearchParams({
		enable_fb_login: '0',
		force_authentication: '1',
		client_id: igAppId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: INSTAGRAM_OAUTH_SCOPES,
		state,
	});
	return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an OAuth authorization code for an Instagram account connection
 */
export async function exchangeOAuthCodeForAccount(
	code: string,
	redirectUriOverride?: string,
	preferredProvider?: string,
): Promise<{ success: boolean; account?: any; error?: string }> {
	const cleanCode = code.replace(/#_.*$/, '').trim();
	const callbackUrl = redirectUriOverride || process.env.META_REDIRECT_URI || '';

	const appId = process.env.META_IG_APP_ID || process.env.META_APP_ID || '';
	const appSecret = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET || '';
	if (preferredProvider === 'facebook') {
		return { success: false, error: 'Facebook Login is not enabled; connect with Instagram Login.' };
	}
	if (!appId || !appSecret || !callbackUrl) {
		return {
			success: false,
			error: 'META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI are required.',
		};
	}

	try {
		const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
			method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'authorization_code', redirect_uri: callbackUrl, code: cleanCode }),
		});
		const tokenData = await tokenRes.json();
		if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error_message || 'Instagram authorization code exchange failed.');
		const shortLivedToken: string = tokenData.access_token;
		const llRes = await fetchWithRetry(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: shortLivedToken })}`);
		const llData = await llRes.json();
		if (!llRes.ok || !llData.access_token) throw new Error(llData.error?.message || 'Could not exchange for a long-lived Instagram token.');
		const accessToken: string = llData.access_token;
		const tokenExpiresAt = new Date(Date.now() + Number(llData.expires_in || 0) * 1000);
		const meRes = await fetchWithRetry(`${GRAPH_API_BASE}/me?fields=id,user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`);
		const igAccount = await meRes.json();
		if (!meRes.ok || !igAccount.id || !igAccount.username) throw new Error(igAccount.error?.message || 'Could not identify an Instagram professional account.');
		const subscriptionRes = await fetchWithRetry(`${GRAPH_API_BASE}/me/subscribed_apps?${new URLSearchParams({ subscribed_fields: 'comments,messages,messaging_postbacks', access_token: accessToken })}`, { method: 'POST' });
		const subscriptionData = await subscriptionRes.json();
		if (!subscriptionRes.ok || subscriptionData.success !== true) {
			throw new Error(subscriptionData.error?.message || 'Instagram account webhook subscription failed. Confirm the Instagram webhook fields are configured in Meta and reconnect.');
		}

		// 5. Encrypt sensitive token and persist to database
		const encryptedToken = encryptToken(accessToken);
		const db = getDb();
		let savedAccountId: string | undefined;

		if (db) {
			const existing = await db
				.select()
				.from(schema.instagramAccounts)
				.where(eq(schema.instagramAccounts.instagramUserId, igAccount.id))
				.limit(1);

			if (existing.length > 0) {
				savedAccountId = existing[0].id;
				await db
					.update(schema.instagramAccounts)
					.set({
						username: igAccount.username || existing[0].username,
						name: igAccount.name || existing[0].name,
						profilePictureUrl: igAccount.profile_picture_url || existing[0].profilePictureUrl,
						accessTokenEncrypted: encryptedToken,
						tokenExpiresAt,
						scopes: INSTAGRAM_OAUTH_SCOPES,
						status: 'connected',
						lastError: null,
						updatedAt: new Date(),
					})
					.where(eq(schema.instagramAccounts.id, existing[0].id));
			} else {
				const [inserted] = await db
					.insert(schema.instagramAccounts)
					.values({
						instagramUserId: igAccount.id,
						username: igAccount.username || 'instagram_user',
						name: igAccount.name || null,
						profilePictureUrl: igAccount.profile_picture_url || null,
						accessTokenEncrypted: encryptedToken,
						tokenExpiresAt,
						scopes: INSTAGRAM_OAUTH_SCOPES,
						status: 'connected',
						lastError: null,
					})
					.returning();
				savedAccountId = inserted?.id;
			}

			// Keep work inside the serverless invocation; no detached in-memory task.
			if (savedAccountId) {
				await syncInstagramMedia(savedAccountId);
			}
		} else throw new Error('DATABASE_URL is not configured; account was not saved.');

		return {
			success: true,
			account: {
				id: savedAccountId,
				instagramUserId: igAccount.id,
				username: igAccount.username,
				name: igAccount.name,
			},
		};
	} catch (error: any) {
		console.error('OAuth flow failed while connecting the Instagram account.');
		return {
			success: false,
		error: error instanceof Error ? error.message.replace(/(access_token|client_secret)=[^&\s]+/gi, '$1=[redacted]') : 'Unexpected error during Instagram connection.',
		};
	}
}

/**
 * Fetch active connected Instagram account from DB
 */
export async function getActiveInstagramAccount(): Promise<schema.InstagramAccount | null> {
	const db = getDb();
	if (!db) return null;

	try {
		const accounts = await db
			.select()
			.from(schema.instagramAccounts)
			.orderBy(desc(schema.instagramAccounts.updatedAt))
			.limit(5);

		if (accounts.length === 0) return null;

		// 1. Prefer explicitly connected accounts
		const connected = accounts.find((a) => a.status === 'connected');
		if (connected) {
			if (connected.tokenExpiresAt && connected.tokenExpiresAt.getTime() < Date.now()) {
				await db.update(schema.instagramAccounts).set({ status: 'expired', lastError: 'Instagram access token expired; reconnect the account.', updatedAt: new Date() }).where(eq(schema.instagramAccounts.id, connected.id));
				return null;
			}
			if (connected.tokenExpiresAt && connected.tokenExpiresAt.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000) {
				try {
					const token = decryptToken(connected.accessTokenEncrypted);
					const response = await fetchWithRetry(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`);
					const refreshed = await response.json();
					if (!response.ok || !refreshed.access_token) throw new Error(refreshed.error?.message || 'Instagram token refresh failed.');
					const updated = { accessTokenEncrypted: encryptToken(refreshed.access_token), tokenExpiresAt: new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000), updatedAt: new Date() };
					await db.update(schema.instagramAccounts).set(updated).where(eq(schema.instagramAccounts.id, connected.id));
					return { ...connected, ...updated };
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Instagram token refresh failed.';
					const invalidToken = /190|invalid oauth access token|cannot parse access token/i.test(message);
					await db.update(schema.instagramAccounts).set({ status: invalidToken ? 'expired' : 'error', lastError: invalidToken ? `Instagram authorization is no longer valid: ${message}. Reconnect the account.` : message, updatedAt: new Date() }).where(eq(schema.instagramAccounts.id, connected.id));
					return null;
				}
			}
			return connected;
		}

		return null;
	} catch (error) {
		console.error('Error fetching active Instagram account:', error);
		return null;
	}
}

/**
 * Sync and fetch Instagram posts & reels from Meta Graph / Instagram API
 */
export async function syncInstagramMedia(
	accountId?: string,
	limit = 50,
): Promise<{ success: boolean; count: number; media: schema.InstagramMedia[]; error?: string }> {
	const db = getDb();
	const account = accountId
		? (await db?.select().from(schema.instagramAccounts).where(eq(schema.instagramAccounts.id, accountId)).limit(1))?.[0]
		: await getActiveInstagramAccount();

	if (!account) {
		return { success: false, count: 0, media: [], error: 'No active connected Instagram account found.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		let rawItems: any[] | null = null;
		let lastApiError: string | null = null;

		// Candidate endpoints ordered by provider type (Instagram Direct vs Facebook Graph)
		let nextUrl: string | undefined = `${GRAPH_API_BASE}/me/media?${new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,username,comments_count,like_count,children{id,media_type,media_url,thumbnail_url}', limit: String(Math.min(100, Math.max(1, limit))), access_token: decryptedToken })}`;
		const maxPages = Math.ceil(Math.min(500, Math.max(1, limit)) / 100);
		for (let page = 0; nextUrl && page < maxPages; page += 1) {
			try {
				const response = await fetchWithRetry(nextUrl);
				const data = await response.json();

				if (response.ok && data && Array.isArray(data.data)) {
					rawItems ||= [];
					rawItems.push(...data.data);
					nextUrl = data.paging?.next;
					if (rawItems.length >= limit) break;
				} else if (data && data.error) {
					lastApiError = data.error.message;
					nextUrl = undefined;
				}
			} catch (fetchErr: any) {
				lastApiError = fetchErr.message;
				nextUrl = undefined;
			}
		}

		if (!rawItems) {
			console.warn('[Media Sync] Could not fetch media items from any Meta/Instagram endpoint. Last error:', lastApiError);
			return {
				success: false,
				count: 0,
				media: [],
				error: lastApiError || 'No posts or media could be retrieved from Instagram.',
			};
		}

		const syncedMedia: schema.InstagramMedia[] = [];

		if (db && rawItems.length > 0) {
		for (const item of rawItems.slice(0, Math.min(500, Math.max(1, limit)))) {
				const mediaType = item.media_product_type === 'REELS' ? 'REELS' : (item.media_type || (item.thumbnail_url ? 'VIDEO' : 'IMAGE'));
				const mediaTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();

				const existing = await db.select().from(schema.instagramMedia).where(eq(schema.instagramMedia.mediaId, item.id)).limit(1);
				if (existing.length > 0) {
					const [updated] = await db
						.update(schema.instagramMedia)
						.set({
							caption: item.caption || null,
							mediaType,
							mediaUrl: item.media_url || item.thumbnail_url || null,
							thumbnailUrl: item.thumbnail_url || item.media_url || null,
							permalink: item.permalink || null,
							commentsCount: item.comments_count || 0,
							likeCount: item.like_count || 0,
							timestamp: mediaTimestamp,
							lastSyncedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(schema.instagramMedia.id, existing[0].id))
						.returning();
					if (updated) syncedMedia.push(updated);
				} else {
					const [inserted] = await db
						.insert(schema.instagramMedia)
						.values({
							accountId: account.id,
							mediaId: item.id,
							caption: item.caption || null,
							mediaType,
							mediaUrl: item.media_url || item.thumbnail_url || null,
							thumbnailUrl: item.thumbnail_url || item.media_url || null,
							permalink: item.permalink || null,
							commentsCount: item.comments_count || 0,
							likeCount: item.like_count || 0,
							timestamp: mediaTimestamp,
							lastSyncedAt: new Date(),
						})
						.returning();
					if (inserted) syncedMedia.push(inserted);
				}
			}
		}

		return { success: true, count: syncedMedia.length, media: syncedMedia };
	} catch (error: any) {
		console.error('Error in syncInstagramMedia:', error);
		return { success: false, count: 0, media: [], error: error.message };
	}
}

/**
 * Get Instagram media from local DB with fallback to live API fetch
 */
export async function getInstagramMediaList(options: {
	type?: 'all' | 'posts' | 'reels';
	limit?: number;
	offset?: number;
}): Promise<{ media: (schema.InstagramMedia & { automationRule?: schema.AutomationRule | null })[]; total: number }> {
	const db = getDb();
	if (!db) return { media: [], total: 0 };

	try {
		const account = await getActiveInstagramAccount();
		if (!account) return { media: [], total: 0 };

		let allMedia = await db
			.select()
			.from(schema.instagramMedia)
			.where(eq(schema.instagramMedia.accountId, account.id))
			.orderBy(desc(schema.instagramMedia.timestamp));

		// If no media in DB yet, attempt on-demand sync from Meta
		if (allMedia.length === 0) {
			const syncRes = await syncInstagramMedia(account.id, options.limit || 50);
			if (syncRes.success && syncRes.media.length > 0) {
				allMedia = await db
					.select()
					.from(schema.instagramMedia)
					.where(eq(schema.instagramMedia.accountId, account.id))
					.orderBy(desc(schema.instagramMedia.timestamp));
			}
		}

		let filtered = allMedia;

		if (options.type === 'posts') {
			filtered = allMedia.filter((m: schema.InstagramMedia) => m.mediaType === 'IMAGE' || m.mediaType === 'CAROUSEL_ALBUM');
		} else if (options.type === 'reels') {
			filtered = allMedia.filter((m: schema.InstagramMedia) => m.mediaType === 'VIDEO' || m.mediaType === 'REELS');
		}

		// Attach associated automation rules
		const rules = await db
			.select()
			.from(schema.automationRules)
			.where(eq(schema.automationRules.accountId, account.id));

		const ruleMap = new Map<string, schema.AutomationRule>();
		for (const r of rules) {
			if (r.mediaId) {
				ruleMap.set(r.mediaId, r);
			}
		}

		const limit = options.limit || 50;
		const offset = options.offset || 0;
		const paged = filtered.slice(offset, offset + limit).map((m: schema.InstagramMedia) => ({
			...m,
			automationRule: (m.mediaId ? ruleMap.get(m.mediaId) : null) || null,
		}));

		return { media: paged, total: filtered.length };
	} catch (error) {
		console.error('Error fetching media list:', error);
		return { media: [], total: 0 };
	}
}

/**
 * Fetch comments for a specific Instagram Post or Reel from official Meta Graph / Instagram API
 */
export async function fetchInstagramComments(
	mediaId: string,
	limit = 25,
): Promise<{ success: boolean; comments: any[]; error?: string }> {
	const account = await getActiveInstagramAccount();
	if (!account) {
		return { success: false, comments: [], error: 'No active Instagram account connected. Reconnect Instagram in Settings to load comments.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const db = getDb();
		const media = await db?.select().from(schema.instagramMedia).where(and(eq(schema.instagramMedia.mediaId, mediaId), eq(schema.instagramMedia.accountId, account.id))).limit(1);
		if (!media?.length) return { success: false, comments: [], error: 'This post or Reel is not in the connected Instagram account. Sync your media and try again.' };

		// Keep to documented comment fields supported by Instagram Login. `from{...}` is not
		// consistently available for comments returned through this API login flow.
		const comments: any[] = [];
		let nextUrl: string | undefined = `${GRAPH_API_BASE}/${encodeURIComponent(mediaId)}/comments?${new URLSearchParams({ fields: 'id,text,timestamp,username,like_count', limit: String(Math.min(100, Math.max(1, limit))), access_token: decryptedToken })}`;
		while (nextUrl && comments.length < Math.min(100, Math.max(1, limit))) {
			const response = await fetchWithRetry(nextUrl);
			const data = await response.json();
			if (!response.ok || !Array.isArray(data?.data)) {
				const errorMessage = data?.error?.message || `Instagram API returned HTTP ${response.status} while loading comments.`;
				if (data?.error?.code === 190) await markAccountForReauthorization(account.id, errorMessage);
				return { success: false, comments: [], error: errorMessage };
			}
			comments.push(...data.data);
			nextUrl = data.paging?.next;
		}
		return { success: true, comments: comments.slice(0, Math.min(100, Math.max(1, limit))) };
	} catch (error: any) {
		return { success: false, comments: [], error: error.message };
	}
}

async function markAccountForReauthorization(accountId: string, reason: string): Promise<void> {
	const db = getDb();
	if (!db) return;
	await db.update(schema.instagramAccounts)
		.set({ status: 'expired', lastError: `Instagram authorization is no longer valid: ${reason}. Reconnect the account.`, updatedAt: new Date() })
		.where(eq(schema.instagramAccounts.id, accountId));
}

/**
 * Fetch Instagram Conversations (Direct Message threads) from official Meta Graph / Instagram API
 */
export async function fetchInstagramConversations(
	limit = 20,
): Promise<{ success: boolean; conversations: any[]; error?: string }> {
	const account = await getActiveInstagramAccount();
	if (!account) {
		return { success: false, conversations: [], error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const endpoints = [`${GRAPH_API_BASE}/${account.instagramUserId}/conversations?${new URLSearchParams({ platform: 'instagram', fields: 'id,updated_time,unread_count,participants,messages{id,message,created_time,from,to}', limit: String(Math.min(100, Math.max(1, limit))), access_token: decryptedToken })}`];

		let convos: any[] = [];
		let lastError: string | null = null;

		for (const url of endpoints) {
			try {
				const response = await fetchWithRetry(url);
				const data = await response.json();
				if (response.ok && data && Array.isArray(data.data)) {
					convos = data.data;
					break;
				} else if (data && data.error) {
					lastError = data.error.message;
					if (data.error.code === 190) await markAccountForReauthorization(account.id, lastError || data.error.message);
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}
		if (lastError) return { success: false, conversations: [], error: lastError };

		const db = getDb();
		// Cache conversations into local database
		if (db && Array.isArray(convos) && convos.length > 0) {
			for (const c of convos) {
				const participant = c.participants?.data?.find((p: any) => p.id !== account.instagramUserId) || c.participants?.data?.[0];
				const latestMsg = c.messages?.data?.[0];
				const participantId = participant?.id || 'unknown';
				const participantUsername = participant?.username || participant?.name || null;
				const lastMessageText = latestMsg?.message || null;
				const lastMessageAt = c.updated_time ? new Date(c.updated_time) : new Date();

				const existing = await db
					.select()
					.from(schema.conversations)
					.where(eq(schema.conversations.instagramConversationId, c.id))
					.limit(1);

				if (existing.length > 0) {
					await db
						.update(schema.conversations)
						.set({
							participantId,
							participantUsername,
							unreadCount: c.unread_count || 0,
							lastMessageText,
							lastMessageAt,
							updatedAt: new Date(),
						})
						.where(eq(schema.conversations.id, existing[0].id));
				} else {
					await db.insert(schema.conversations).values({
						accountId: account.id,
						instagramConversationId: c.id,
						participantId,
						participantUsername,
						unreadCount: c.unread_count || 0,
						lastMessageText,
						lastMessageAt,
					});
				}
			}
		}

		return { success: true, conversations: convos };
	} catch (error: any) {
		return { success: false, conversations: [], error: error.message };
	}
}

/**
 * Fetch messages inside a specific Instagram Conversation
 */
export async function fetchConversationMessages(
	conversationId: string,
	limit = 50,
): Promise<{ success: boolean; messages: any[]; error?: string }> {
	const account = await getActiveInstagramAccount();
	if (!account) {
		return { success: false, messages: [], error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const response = await fetchWithRetry(`${GRAPH_API_BASE}/${conversationId}/messages?${new URLSearchParams({ fields: 'id,created_time,from,to,message', limit: String(Math.min(100, Math.max(1, limit))), access_token: decryptedToken })}`);
		const data = await response.json();
		if (!response.ok || !Array.isArray(data.data)) {
			const error = data.error?.message || `Instagram API returned HTTP ${response.status}.`;
			if (data.error?.code === 190) await markAccountForReauthorization(account.id, error);
			return { success: false, messages: [], error };
		}
		return { success: true, messages: data.data };
	} catch (error: any) {
		return { success: false, messages: [], error: error.message };
	}
}

/**
 * Format personalized response template with dynamic variables {{first_name}}, {{username}}, {{link}}
 */
export function formatPersonalizedMessage(
	template: string,
	variables: { firstName?: string; username?: string; link?: string | null },
): string {
	let output = template;
	const firstName = variables.firstName || variables.username || 'there';
	const username = variables.username || firstName;
	const link = variables.link || '';

	output = output.replace(/{{\s*first_name\s*}}/gi, firstName);
	output = output.replace(/{{\s*username\s*}}/gi, username);
	output = output.replace(/{{\s*link\s*}}/gi, link);

	return output;
}

/**
 * Send an Instagram Direct Message using official Meta Graph / Instagram API
 */
export async function sendInstagramMessage(
	recipientId: string,
	text: string,
	url?: string | null,
	accountOverride?: schema.InstagramAccount,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const account = accountOverride || (await getActiveInstagramAccount());
	if (!account) {
		return { success: false, error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const messageText = url && !text.includes(url) ? `${text}\n\n${url}` : text;

		const response = await fetch(`${GRAPH_API_BASE}/${account.instagramUserId}/messages`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${decryptedToken}` },
			body: JSON.stringify({ recipient: { id: recipientId }, message: { text: messageText } }),
		});
		const data = await response.json();
		if (response.ok && data.message_id) return { success: true, messageId: data.message_id };
		const error = data.error?.message || `Instagram Send API returned HTTP ${response.status}.`;
		if (data.error?.code === 190) await markAccountForReauthorization(account.id, error);
		return { success: false, error };
	} catch (error: any) {
		return { success: false, error: error.message || 'Failed to send Instagram DM' };
	}
}

/**
 * Send an official Instagram Private Reply to a comment
 */
export async function sendInstagramPrivateReply(
	commentId: string,
	text: string,
	url?: string | null,
	accountOverride?: schema.InstagramAccount,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	const account = accountOverride || (await getActiveInstagramAccount());
	if (!account) {
		return { success: false, error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const messageText = url && !text.includes(url) ? `${text}\n\n${url}` : text;

		const response = await fetch(`${GRAPH_API_BASE}/${account.instagramUserId}/messages`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${decryptedToken}` },
			body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: messageText } }),
		});
		const data = await response.json();
		if (response.ok && data.message_id) return { success: true, messageId: data.message_id };
		const error = data.error?.message || `Instagram Private Reply returned HTTP ${response.status}.`;
		if (data.error?.code === 190) await markAccountForReauthorization(account.id, error);
		return { success: false, error };
	} catch (error: any) {
		return { success: false, error: error.message || 'Failed to send Instagram Private Reply' };
	}
}

/**
 * Post an official Public Reply to a comment on Instagram
 */
export async function sendInstagramPublicCommentReply(
	commentId: string,
	text: string,
	accountOverride?: schema.InstagramAccount,
): Promise<{ success: boolean; replyCommentId?: string; error?: string }> {
	const account = accountOverride || (await getActiveInstagramAccount());
	if (!account) {
		return { success: false, error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const response = await fetch(`${GRAPH_API_BASE}/${commentId}/replies`, {
			method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${decryptedToken}` }, body: JSON.stringify({ message: text }),
		});
		const data = await response.json();
		if (response.ok && data.id) return { success: true, replyCommentId: data.id };
		return { success: false, error: data.error?.message || `Instagram comment reply returned HTTP ${response.status}.` };
	} catch (error: any) {
		return { success: false, error: error.message || 'Failed to send public comment reply' };
	}
}

/**
 * Disconnect an Instagram account
 */
export async function disconnectInstagramAccount(accountId: string): Promise<boolean> {
	const db = getDb();
	if (!db) return false;

	await db
		.update(schema.instagramAccounts)
		.set({
			status: 'disconnected',
			updatedAt: new Date(),
		})
		.where(eq(schema.instagramAccounts.id, accountId));

	return true;
}
