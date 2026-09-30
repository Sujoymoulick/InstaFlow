import { getDb, schema } from '../db/index.js';
import { eq, desc, and } from 'drizzle-orm';
import { decryptToken, encryptToken } from '../lib/crypto.js';

export const META_API_VERSION = process.env.META_API_VERSION || 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const INSTAGRAM_OAUTH_SCOPES =
	process.env.META_OAUTH_SCOPES ||
	[
		'instagram_business_basic',
		'instagram_business_manage_messages',
		'instagram_business_manage_comments',
		'instagram_business_content_publish',
	].join(',');

export interface InstagramOAuthConfig {
	appId: string;
	appSecret: string;
	redirectUri: string;
}

export function getOAuthConfig(): InstagramOAuthConfig {
	const appId = process.env.META_APP_ID || '';
	const appSecret = process.env.META_APP_SECRET || '';
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
				console.warn(`[Meta API] Received status ${response.status} on ${url}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				delay *= 2;
				continue;
			}

			return response;
		} catch (error: any) {
			if (attempt <= maxRetries) {
				console.warn(`[Meta API] Network fetch error on ${url}: ${error.message}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
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
	
	if (provider === 'facebook') {
		const fbAppId = process.env.META_FB_APP_ID || process.env.META_APP_ID || '2251185325743698';
		const params = new URLSearchParams({
			client_id: fbAppId,
			redirect_uri: redirectUri,
			scope: INSTAGRAM_OAUTH_SCOPES,
			state,
			response_type: 'code',
		});
		return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
	}

	// Default: Direct Instagram Login for Business
	const igAppId = process.env.META_IG_APP_ID || (process.env.META_APP_ID === '2216387435958871' ? process.env.META_APP_ID : '2216387435958871');
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

	const defaultSecret = process.env.META_APP_SECRET || '';
	const igAppId = process.env.META_IG_APP_ID || '2216387435958871';
	const igSecret = process.env.META_IG_APP_SECRET || defaultSecret;

	const fbAppId = process.env.META_FB_APP_ID || process.env.META_APP_ID || '2251185325743698';
	const fbSecret = process.env.META_FB_APP_SECRET || defaultSecret;

	const appConfigs: Array<{ appId: string; appSecret: string; type: 'ig' | 'fb' }> = [];
	
	if (preferredProvider === 'facebook') {
		if (fbAppId && fbSecret) appConfigs.push({ appId: fbAppId, appSecret: fbSecret, type: 'fb' });
		if (igAppId && igSecret && igAppId !== fbAppId) appConfigs.push({ appId: igAppId, appSecret: igSecret, type: 'ig' });
	} else {
		if (igAppId && igSecret) appConfigs.push({ appId: igAppId, appSecret: igSecret, type: 'ig' });
		if (fbAppId && fbSecret && fbAppId !== igAppId) appConfigs.push({ appId: fbAppId, appSecret: fbSecret, type: 'fb' });
	}

	if (appConfigs.length === 0) {
		return {
			success: false,
			error: 'Meta App credentials (META_APP_SECRET / META_APP_ID) are missing from environment variables.',
		};
	}

	try {
		let shortLivedToken: string | null = null;
		let successfulAppId = appConfigs[0].appId;
		let successfulAppSecret = appConfigs[0].appSecret;

		// 1. Try exchanging code against candidates
		for (const cfg of appConfigs) {
			// Method A: Graph API OAuth access token endpoint
			try {
				const graphTokenUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
					client_id: cfg.appId,
					client_secret: cfg.appSecret,
					redirect_uri: callbackUrl,
					code: cleanCode,
				}).toString()}`;

				const response = await fetchWithRetry(graphTokenUrl);
				const data = await response.json();
				if (data && data.access_token) {
					shortLivedToken = data.access_token;
					successfulAppId = cfg.appId;
					successfulAppSecret = cfg.appSecret;
					break;
				}
			} catch (e) {
				console.warn(`Graph API token exchange attempt notice for app ${cfg.appId}:`, e);
			}

			// Method B: Instagram Direct API access token endpoint
			try {
				const igFormData = new URLSearchParams({
					client_id: cfg.appId,
					client_secret: cfg.appSecret,
					grant_type: 'authorization_code',
					redirect_uri: callbackUrl,
					code: cleanCode,
				});

				const igResponse = await fetchWithRetry('https://api.instagram.com/oauth/access_token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: igFormData.toString(),
				});
				const igData = await igResponse.json();
				if (igData && igData.access_token) {
					shortLivedToken = igData.access_token;
					successfulAppId = cfg.appId;
					successfulAppSecret = cfg.appSecret;
					break;
				}
			} catch (igErr) {
				console.warn(`Instagram direct token exchange attempt notice for app ${cfg.appId}:`, igErr);
			}
		}

		if (!shortLivedToken) {
			return {
				success: false,
				error: 'Failed to exchange authorization code for an access token with Meta. Please verify META_APP_SECRET and App ID.',
			};
		}

		// 2. Exchange short-lived token for long-lived access token (60-day)
		let accessToken = shortLivedToken;
		let tokenExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

		// Try FB long-lived exchange
		try {
			const longLivedUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
				grant_type: 'fb_exchange_token',
				client_id: successfulAppId,
				client_secret: successfulAppSecret,
				fb_exchange_token: shortLivedToken,
			}).toString()}`;

			const longLivedResponse = await fetchWithRetry(longLivedUrl);
			const longLivedData = await longLivedResponse.json();
			if (longLivedData.access_token) {
				accessToken = longLivedData.access_token;
				const expiresIn = longLivedData.expires_in ? Number(longLivedData.expires_in) : 60 * 24 * 3600;
				tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
			}
		} catch (llErr) {
			// Try IG long-lived exchange
			try {
				const igLongLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${successfulAppSecret}&access_token=${shortLivedToken}`;
				const igLongLivedResponse = await fetchWithRetry(igLongLivedUrl);
				const igLongLivedData = await igLongLivedResponse.json();
				if (igLongLivedData.access_token) {
					accessToken = igLongLivedData.access_token;
					const expiresIn = igLongLivedData.expires_in ? Number(igLongLivedData.expires_in) : 60 * 24 * 3600;
					tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
				}
			} catch (igLLErr) {
				console.warn('Long-lived token exchange notice (using short-lived token):', igLLErr);
			}
		}

		// 3. Resolve Instagram Account info
		let igAccount: any = null;
		let pageAccessToken = accessToken;
		let pageId: string | null = null;

		// 3A. Check direct Instagram User Account info (Instagram Login for Business)
		try {
			const directMeUrl = `${GRAPH_API_BASE}/me?fields=id,username,name,profile_picture_url&access_token=${accessToken}`;
			const directMeRes = await fetchWithRetry(directMeUrl);
			const directMeData = await directMeRes.json();
			if (directMeData && directMeData.id && directMeData.username) {
				igAccount = directMeData;
			}
		} catch (meErr) {
			console.warn('Direct Graph API /me check notice:', meErr);
		}

		// 3B. Check Instagram Basic Display / Graph Me
		if (!igAccount) {
			try {
				const igMeUrl = `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`;
				const igMeRes = await fetchWithRetry(igMeUrl);
				const igMeData = await igMeRes.json();
				if (igMeData && igMeData.id && igMeData.username) {
					igAccount = {
						id: igMeData.id,
						username: igMeData.username,
						name: igMeData.username,
					};
				}
			} catch (igMeErr) {
				console.warn('Instagram Graph /me check notice:', igMeErr);
			}
		}

		// 3C. Check connected Facebook Pages with Instagram Business Account
		if (!igAccount) {
			try {
				const pagesUrl = `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`;
				const pagesResponse = await fetchWithRetry(pagesUrl);
				const pagesData = await pagesResponse.json();

				if (pagesData.data && Array.isArray(pagesData.data)) {
					for (const page of pagesData.data) {
						if (page.instagram_business_account) {
							igAccount = page.instagram_business_account;
							pageAccessToken = page.access_token || accessToken;
							pageId = page.id;
							break;
						}
					}
				}
			} catch (pagesErr) {
				console.warn('Facebook Pages check notice:', pagesErr);
			}
		}

		if (!igAccount) {
			return {
				success: false,
				error:
					'No Instagram Professional/Business account found. Please ensure your Instagram account is a Creator or Business account and permissions are granted.',
			};
		}

		// 4. Subscribe the app to the Page webhooks for Instagram (messages, comments, messaging_postbacks)
		if (pageId && pageAccessToken) {
			try {
				const subscribeUrl = `${GRAPH_API_BASE}/${pageId}/subscribed_apps`;
				await fetchWithRetry(subscribeUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						subscribed_fields: ['messages', 'comments', 'messaging_postbacks'],
						access_token: pageAccessToken,
					}),
				});
			} catch (subErr) {
				console.warn('Webhook auto-subscription notice (non-fatal):', subErr);
			}
		}

		// 5. Encrypt sensitive token and persist to database
		const encryptedToken = encryptToken(pageAccessToken);
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

			// 6. Trigger initial background media synchronization
			if (savedAccountId) {
				syncInstagramMedia(savedAccountId).catch((err) => {
					console.error('Initial media sync notice:', err.message);
				});
			}
		}

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
		console.error('OAuth flow error:', error);
		return {
			success: false,
			error: error.message || 'Unexpected error during Instagram connection.',
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
		if (connected) return connected;

		// 2. Fall back to any non-disconnected account and self-heal status
		const recoverable = accounts.find((a) => a.status !== 'disconnected');
		if (recoverable) {
			await db
				.update(schema.instagramAccounts)
				.set({ status: 'connected', lastError: null, updatedAt: new Date() })
				.where(eq(schema.instagramAccounts.id, recoverable.id));
			return { ...recoverable, status: 'connected', lastError: null };
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
		const candidateUrls = [
			// Candidate A: Instagram Basic / Direct User Media endpoint
			`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,children{id,media_type,media_url,thumbnail_url}&limit=${limit}&access_token=${decryptedToken}`,
			// Candidate B: Instagram Direct User ID endpoint
			`https://graph.instagram.com/${account.instagramUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username&limit=${limit}&access_token=${decryptedToken}`,
			// Candidate C: Facebook Page Graph API Instagram Business Account with metrics
			`${GRAPH_API_BASE}/${account.instagramUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count&limit=${limit}&access_token=${decryptedToken}`,
			// Candidate D: Facebook Page Graph API with standard fields
			`${GRAPH_API_BASE}/${account.instagramUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${decryptedToken}`,
			// Candidate E: Facebook Graph /me/media endpoint
			`${GRAPH_API_BASE}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${decryptedToken}`,
		];

		for (const url of candidateUrls) {
			try {
				const response = await fetchWithRetry(url);
				const data = await response.json();

				if (data && Array.isArray(data.data)) {
					rawItems = data.data;
					break;
				} else if (data && data.error) {
					lastApiError = data.error.message;
					console.warn(`[Media Sync] Notice from ${url.split('?')[0]}: ${data.error.message}`);
				}
			} catch (fetchErr: any) {
				lastApiError = fetchErr.message;
				console.warn(`[Media Sync] Network notice on ${url.split('?')[0]}: ${fetchErr.message}`);
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
			for (const item of rawItems) {
				const mediaType = item.media_type || (item.thumbnail_url ? 'VIDEO' : 'IMAGE');
				const mediaTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();

				const existing = await db
					.select()
					.from(schema.instagramMedia)
					.where(eq(schema.instagramMedia.mediaId, item.id))
					.limit(1);

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
		return { success: false, comments: [], error: 'No active Instagram account connected.' };
	}

	try {
		const decryptedToken = decryptToken(account.accessTokenEncrypted);
		const candidateUrls = [
			// Direct Instagram Graph endpoints
			`https://graph.instagram.com/${mediaId}/comments?fields=id,text,timestamp,username,like_count,from{id,username}&limit=${limit}&access_token=${decryptedToken}`,
			`https://graph.instagram.com/${mediaId}/comments?fields=id,text,timestamp,username&limit=${limit}&access_token=${decryptedToken}`,
			// Facebook Graph API endpoints
			`${GRAPH_API_BASE}/${mediaId}/comments?fields=id,text,timestamp,username,from,like_count,replies{id,text,username,timestamp}&limit=${limit}&access_token=${decryptedToken}`,
			`${GRAPH_API_BASE}/${mediaId}/comments?fields=id,text,timestamp,username,from&limit=${limit}&access_token=${decryptedToken}`,
			`${GRAPH_API_BASE}/${mediaId}/comments?fields=id,text,timestamp&limit=${limit}&access_token=${decryptedToken}`,
		];

		let comments: any[] | null = null;
		let lastError: string | null = null;

		for (const url of candidateUrls) {
			try {
				const response = await fetchWithRetry(url);
				const data = await response.json();
				if (data && Array.isArray(data.data)) {
					comments = data.data;
					break;
				} else if (data && data.error) {
					lastError = data.error.message;
					console.warn(`[Comments Fetch] Notice from ${url.split('?')[0]}: ${data.error.message}`);
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}

		if (comments === null) {
			return { success: false, comments: [], error: lastError || 'Failed to fetch comments.' };
		}

		return { success: true, comments };
	} catch (error: any) {
		return { success: false, comments: [], error: error.message };
	}
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
		const endpoints = [
			`https://graph.instagram.com/me/conversations?fields=id,updated_time,unread_count,participants,messages{id,message,created_time,from,to}&limit=${limit}&access_token=${decryptedToken}`,
			`${GRAPH_API_BASE}/${account.instagramUserId}/conversations?platform=instagram&fields=id,updated_time,unread_count,participants,messages{id,message,created_time,from,to}&limit=${limit}&access_token=${decryptedToken}`,
			`${GRAPH_API_BASE}/me/conversations?platform=instagram&fields=id,updated_time,unread_count,participants,messages{id,message,created_time,from,to}&limit=${limit}&access_token=${decryptedToken}`,
		];

		let convos: any[] = [];
		let lastError: string | null = null;

		for (const url of endpoints) {
			try {
				const response = await fetchWithRetry(url);
				const data = await response.json();
				if (data && Array.isArray(data.data)) {
					convos = data.data;
					break;
				} else if (data && data.error) {
					lastError = data.error.message;
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}

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
		const endpoints = [
			`https://graph.instagram.com/${conversationId}/messages?fields=id,created_time,from,to,message&limit=${limit}&access_token=${decryptedToken}`,
			`${GRAPH_API_BASE}/${conversationId}/messages?fields=id,created_time,from,to,message&limit=${limit}&access_token=${decryptedToken}`,
		];

		for (const url of endpoints) {
			try {
				const response = await fetchWithRetry(url);
				const data = await response.json();
				if (data && Array.isArray(data.data)) {
					return { success: true, messages: data.data };
				}
			} catch (e) {}
		}

		return { success: true, messages: [] };
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

		const endpoints = [
			`https://graph.instagram.com/${META_API_VERSION}/me/messages`,
			`https://graph.instagram.com/me/messages`,
			`${GRAPH_API_BASE}/me/messages`,
			`${GRAPH_API_BASE}/${account.instagramUserId}/messages`,
		];

		let lastError: string | null = null;
		for (const ep of endpoints) {
			try {
				const response = await fetchWithRetry(ep, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${decryptedToken}`,
					},
					body: JSON.stringify({
						recipient: { id: recipientId },
						message: { text: messageText },
					}),
				});

				const data = await response.json();
				if (data && (data.message_id || data.recipient_id)) {
					return {
						success: true,
						messageId: data.message_id || data.recipient_id,
					};
				}
				if (data && data.error) {
					lastError = `${data.error.message} (code: ${data.error.code})`;
					console.warn(`[Send DM] Notice from ${ep}:`, data.error);
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}

		return {
			success: false,
			error: lastError || 'Failed to deliver Instagram DM.',
		};
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

		const endpoints = [
			`https://graph.instagram.com/${META_API_VERSION}/me/messages`,
			`https://graph.instagram.com/me/messages`,
			`${GRAPH_API_BASE}/me/messages`,
			`${GRAPH_API_BASE}/${account.instagramUserId}/messages`,
		];

		let lastError: string | null = null;
		for (const ep of endpoints) {
			try {
				const response = await fetchWithRetry(ep, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${decryptedToken}`,
					},
					body: JSON.stringify({
						recipient: { comment_id: commentId },
						message: { text: messageText },
					}),
				});

				const data = await response.json();
				if (data && (data.message_id || data.recipient_id)) {
					return {
						success: true,
						messageId: data.message_id || data.recipient_id,
					};
				}
				if (data && data.error) {
					lastError = `${data.error.message} (code: ${data.error.code})`;
					console.warn(`[Private Reply] Notice from ${ep}:`, data.error);
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}

		return {
			success: false,
			error: lastError || 'Failed to send Instagram Private Reply',
		};
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
		const endpoints = [
			`https://graph.instagram.com/${META_API_VERSION}/${commentId}/replies`,
			`https://graph.instagram.com/${commentId}/replies`,
			`${GRAPH_API_BASE}/${commentId}/replies`,
		];

		let lastError: string | null = null;
		for (const ep of endpoints) {
			try {
				const response = await fetchWithRetry(ep, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${decryptedToken}`,
					},
					body: JSON.stringify({ message: text }),
				});

				const data = await response.json();
				if (data && data.id) {
					return { success: true, replyCommentId: data.id };
				}
				if (data && data.error) {
					lastError = `${data.error.message} (code: ${data.error.code})`;
				}
			} catch (e: any) {
				lastError = e.message;
			}
		}

		return { success: false, error: lastError || 'Failed to send public comment reply' };
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
