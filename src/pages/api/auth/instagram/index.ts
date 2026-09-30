import type { APIRoute } from 'astro';
import { generateOAuthState } from '../../../../lib/crypto.js';
import { isAuthorizedAdmin } from '../../../../lib/auth.js';
import { getMetaAuthorizationUrl } from '../../../../services/instagram.js';

export const prerender = false;

export const get: APIRoute = async ({ cookies, url, request }) => {
	if (!isAuthorizedAdmin(request, cookies)) return new Response('Unauthorized', { status: 401 });
	const state = generateOAuthState();
	const providerParam = url.searchParams.get('provider') || url.searchParams.get('type');
	const provider = providerParam === 'facebook' ? 'facebook' : 'instagram';

	// Store OAuth state in secure HTTP-only cookie for CSRF validation
	cookies.set('meta_oauth_state', state, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 60 * 15, // 15 minutes
	});

	// Store OAuth provider selection
	cookies.set('meta_oauth_provider', provider, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 60 * 15,
	});

	// Derive current origin callback if META_REDIRECT_URI is not explicitly defined
	const originCallback = `${url.origin}/api/auth/instagram/callback`;
	let authUrl: string;
	try {
		authUrl = getMetaAuthorizationUrl(state, process.env.META_REDIRECT_URI || originCallback, provider);
	} catch (error) {
		return new Response(error instanceof Error ? error.message : 'Instagram OAuth is not configured.', { status: 503 });
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: authUrl,
		},
	});
};

export const GET = get;
