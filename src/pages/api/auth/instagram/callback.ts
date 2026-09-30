import type { APIRoute } from 'astro';
import { exchangeOAuthCodeForAccount } from '../../../../services/instagram.js';

export const prerender = false;

export const get: APIRoute = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	const savedState = cookies.get('meta_oauth_state')?.value;
	cookies.delete('meta_oauth_state', { path: '/' });

	const redirectSettings = (params: Record<string, string>) => {
		const q = new URLSearchParams(params).toString();
		return new Response(null, {
			status: 302,
			headers: { Location: `/settings/instagram?${q}` },
		});
	};

	if (error) {
		return redirectSettings({
			status: 'error',
			message: errorDescription || error,
		});
	}

	if (!code) {
		return redirectSettings({
			status: 'error',
			message: 'Authorization code missing from Meta callback',
		});
	}

	if (!state || !savedState || state !== savedState) {
		return redirectSettings({
			status: 'error',
			message: 'Invalid or expired OAuth state parameter (CSRF protection)',
		});
	}

	const originCallback = `${url.origin}/api/auth/instagram/callback`;
	const result = await exchangeOAuthCodeForAccount(
		code,
		process.env.META_REDIRECT_URI || originCallback,
	);

	if (!result.success) {
		return redirectSettings({
			status: 'error',
			message: result.error || 'Failed to link Instagram account',
		});
	}

	return redirectSettings({
		status: 'success',
		message: `Successfully connected Instagram account @${result.account?.username}`,
	});
};

export const GET = get;
