import { verifyAdminSession } from './lib/auth.js';

export async function onRequest(context: any, next: () => Promise<Response>): Promise<Response | void> {
	const url = new URL(context.request.url);
	const pathname = url.pathname;

	// Public paths exempt from auth redirect
	const isPublic =
		pathname.startsWith('/authentication') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/pages') ||
		pathname.startsWith('/playground') ||
		pathname.startsWith('/_astro') ||
		pathname.includes('.') || // static assets like images, js, css, favicons
		pathname === '/favicon.svg';

	if (!isPublic) {
		const session = verifyAdminSession(context.cookies, context.request);
		if (!session.authorized) {
			return new Response(null, {
				status: 302,
				headers: {
					Location: '/authentication/sign-in',
				},
			});
		}
	}

	await next();
}
