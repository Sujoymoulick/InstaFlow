import { getDb, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { decryptToken, encryptToken } from '../lib/crypto.js';

export const META_API_VERSION = process.env.META_API_VERSION || 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const INSTAGRAM_OAUTH_SCOPES = [
	'instagram_basic',
	'instagram_manage_messages',
	'instagram_manage_comments',
	'pages_show_list',
	'pages_read_engagement',
	'pages_manage_metadata',
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
 * Build the official Meta OAuth authorization URL
 */
export function getMetaAuthorizationUrl(state: string, redirectUriOverride?: string): string {
	const { appId, redirectUri } = getOAuthConfig();
	const callbackUrl = redirectUriOverride || redirectUri;
	const params = new URLSearchParams({
		client_id: appId,
		redirect_uri: callbackUrl,
		scope: INSTAGRAM_OAUTH_SCOPES,
		state,
		response_type: 'code',
	});

	return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange an OAuth authorization code for an Instagram account connection
 */
export async function exchangeOAuthCodeForAccount(
	code: string,
	redirectUriOverride?: string,
): Promise<{ success: boolean; account?: any; error?: string }> {
	const { appId, appSecret, redirectUri } = getOAuthConfig();
	const callbackUrl = redirectUriOverride || redirectUri;

	if (!appId || !appSecret || !callbackUrl) {
		return {
			success: false,
			error: 'Meta App credentials or Redirect URI are missing in environment variables.',
		};
	}

	try {
		// 1. Exchange code for short-lived user access token
		const tokenUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
			client_id: appId,
			client_secret: appSecret,
			redirect_uri: callbackUrl,
			code,
		}).toString()}`;

		const tokenResponse = await fetch(tokenUrl);
		const tokenData = await tokenResponse.json();

		if (tokenData.error) {
			console.error('Meta token exchange error:', tokenData.error);
			return {
				success: false,
				error: tokenData.error.message || 'Failed to exchange authorization code.',
			};
		}

		const shortLivedToken = tokenData.access_token;

		// 2. Exchange short-lived token for long-lived access token (60-day)
		const longLivedUrl = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
			grant_type: 'fb_exchange_token',
			client_id: appId,
			client_secret: appSecret,
			fb_exchange_token: shortLivedToken,
		}).toString()}`;

		const longLivedResponse = await fetch(longLivedUrl);
		const longLivedData = await longLivedResponse.json();
		const accessToken = longLivedData.access_token || shortLivedToken;
		const expiresIn = longLivedData.expires_in ? Number(longLivedData.expires_in) : 60 * 24 * 3600;
		const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

		// 3. Find connected Facebook Page with an Instagram Business / Creator Account
		const pagesUrl = `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`;
		const pagesResponse = await fetch(pagesUrl);
		const pagesData = await pagesResponse.json();

		if (pagesData.error) {
			return {
				success: false,
				error: pagesData.error.message || 'Failed to fetch connected Facebook Pages.',
			};
		}

		let igAccount: any = null;
		let pageAccessToken = accessToken;

		if (pagesData.data && Array.isArray(pagesData.data)) {
			for (const page of pagesData.data) {
				if (page.instagram_business_account) {
					igAccount = page.instagram_business_account;
					pageAccessToken = page.access_token || accessToken;
					break;
				}
			}
		}

		if (!igAccount) {
			return {
				success: false,
				error:
					'No Instagram Professional/Business account found linked to your Facebook Pages. Please ensure your Instagram account is set to Professional and connected to a Facebook Page.',
			};
		}

		// 4. Encrypt sensitive token and persist to database
		const encryptedToken = encryptToken(pageAccessToken);
		const db = getDb();

		if (db) {
			const existing = await db
				.select()
				.from(schema.instagramAccounts)
				.where(eq(schema.instagramAccounts.instagramUserId, igAccount.id))
				.limit(1);

			if (existing.length > 0) {
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
				await db.insert(schema.instagramAccounts).values({
					instagramUserId: igAccount.id,
					username: igAccount.username || 'instagram_user',
					name: igAccount.name || null,
					profilePictureUrl: igAccount.profile_picture_url || null,
					accessTokenEncrypted: encryptedToken,
					tokenExpiresAt,
					scopes: INSTAGRAM_OAUTH_SCOPES,
					status: 'connected',
					lastError: null,
				});
			}
		}

		return {
			success: true,
			account: {
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

	const accounts = await db
		.select()
		.from(schema.instagramAccounts)
		.where(eq(schema.instagramAccounts.status, 'connected'))
		.limit(1);

	return accounts[0] || null;
}

/**
 * Send an Instagram Direct Message using official Meta Graph API
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
		const messageText = url ? `${text}\n\n${url}` : text;

		const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
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

		if (data.error) {
			console.error('Meta Send Message error:', data.error);
			return {
				success: false,
				error: `${data.error.message} (code: ${data.error.code})`,
			};
		}

		return {
			success: true,
			messageId: data.message_id || data.recipient_id,
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
		const messageText = url ? `${text}\n\n${url}` : text;

		// Official Meta Instagram Messaging Private Reply endpoint:
		// POST /v19.0/me/messages with recipient: { comment_id: "<COMMENT_ID>" }
		const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
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

		if (data.error) {
			console.error('Meta Private Reply error:', data.error);
			return {
				success: false,
				error: `${data.error.message} (code: ${data.error.code})`,
			};
		}

		return {
			success: true,
			messageId: data.message_id || data.recipient_id,
		};
	} catch (error: any) {
		return { success: false, error: error.message || 'Failed to send Instagram Private Reply' };
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
