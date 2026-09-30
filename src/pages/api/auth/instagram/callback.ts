import type { APIRoute } from 'astro';
import { exchangeOAuthCodeForAccount } from '../../../../services/instagram.js';

export const prerender = false;

export const get: APIRoute = async ({ url, cookies }) => {
	let code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');
	const errorReason = url.searchParams.get('error_reason');
	const errorMessage = url.searchParams.get('error_message');

	const savedState = cookies.get('meta_oauth_state')?.value;
	const savedProvider = cookies.get('meta_oauth_provider')?.value;

	// Clean up one-time OAuth cookies
	cookies.delete('meta_oauth_state', { path: '/' });
	cookies.delete('meta_oauth_provider', { path: '/' });

	const redirectSettings = (params: Record<string, string>) => {
		const q = new URLSearchParams(params).toString();
		return new Response(null, {
			status: 302,
			headers: { Location: `/settings/instagram?${q}` },
		});
	};

	// 1. Handle Meta OAuth cancellation or permission denial
	if (error || errorDescription || errorReason || errorMessage) {
		const msg =
			errorDescription ||
			errorMessage ||
			(errorReason ? `Meta authorization: ${errorReason}` : null) ||
			error ||
			'Authentication was cancelled or denied.';
		return redirectSettings({
			status: 'error',
			message: msg,
		});
	}

	// 2. Validate presence of authorization code
	if (!code) {
		return redirectSettings({
			status: 'error',
			message:
				'Authorization code missing from Meta callback. Please ensure you approved all required permissions in the Meta consent window.',
		});
	}

	code = code.replace(/#_.*$/, '').trim();

	// 3. CSRF State validation (allow graceful matching if state parameter is valid)
	if (!savedState || !state || state !== savedState) {
		return redirectSettings({
			status: 'error',
			message: 'OAuth state mismatch (CSRF protection). Please restart the connection flow from settings.',
		});
	}

	// 4. Exchange code for Instagram Account access
	const originCallback = `${url.origin}/api/auth/instagram/callback`;
	const result = await exchangeOAuthCodeForAccount(
		code,
		process.env.META_REDIRECT_URI || originCallback,
		savedProvider || 'instagram',
	);

	if (!result.success) {
		return redirectSettings({
			status: 'error',
			message: result.error || 'Failed to link Instagram account.',
		});
	}

	return redirectSettings({
		status: 'success',
		message: `Successfully connected Instagram account @${result.account?.username || 'user'}`,
	});
};

export const GET = get;
