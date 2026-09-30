import type { APIRoute } from 'astro';
import { generateOAuthState } from '../../../../lib/crypto.js';
import { getMetaAuthorizationUrl } from '../../../../services/instagram.js';

export const prerender = false;

export const get: APIRoute = async ({ cookies, url }) => {
	const state = generateOAuthState();
	const providerParam = url.searchParams.get('provider') || url.searchParams.get('type');
	const provider = providerParam === 'facebook' ? 'facebook' : 'instagram';

	// Store OAuth state in secure HTTP-only cookie for CSRF validation
	cookies.set('meta_oauth_state', state, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 15, // 15 minutes
	});

	// Store OAuth provider selection
	cookies.set('meta_oauth_provider', provider, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: 60 * 15,
	});

	// Derive current origin callback if META_REDIRECT_URI is not explicitly defined
	const originCallback = `${url.origin}/api/auth/instagram/callback`;
	const authUrl = getMetaAuthorizationUrl(state, process.env.META_REDIRECT_URI || originCallback, provider);

	return new Response(null, {
		status: 302,
		headers: {
			Location: authUrl,
		},
	});
};

export const GET = get;
