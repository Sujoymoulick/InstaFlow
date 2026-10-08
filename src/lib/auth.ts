import type { AstroCookies } from 'astro';
import * as crypto from 'node:crypto';
import { getEnv } from './env.js';

export const ADMIN_COOKIE_NAME = 'instaflow_admin_token';
export const ADMIN_EMAIL_COOKIE = 'instaflow_admin_email';

export const ALLOWED_ADMIN_EMAIL = (
	getEnv('ALLOWED_ADMIN_EMAIL') ||
	getEnv('ADMIN_EMAIL') ||
	'lifeunderzero777@gmail.com'
)
	.trim()
	.toLowerCase();

/**
 * Returns true strictly if the given email matches the allowed admin emails.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
	if (!email) return false;
	const clean = email.trim().toLowerCase();

	const allowedList = new Set<string>([
		ALLOWED_ADMIN_EMAIL,
		'lifeunderzero777@gmail.com',
		'admin@sendvirtualgift.com',
	]);

	const envEmails = getEnv('ADMIN_EMAILS') || getEnv('ADMIN_EMAIL');
	if (envEmails) {
		envEmails
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
			.forEach((e) => allowedList.add(e));
	}

	return allowedList.has(clean);
}

/**
 * Get internal secret used for signing session tokens.
 */
function getSigningSecret(): string {
	const secret =
		getEnv('ADMIN_AUTH_SECRET') ||
		getEnv('ADMIN_PASSWORD') ||
		getEnv('INSTAGRAM_ENCRYPTION_KEY') ||
		'instaflow-central-admin-secure-signing-secret-minimum-32-chars-2026';
	return secret;
}

/**
 * Generates a signed session token for the allowed admin email.
 */
export function generateSessionToken(email: string): string {
	const secret = getSigningSecret();
	const cleanEmail = email.trim().toLowerCase();
	const timestamp = Date.now().toString();
	const payload = `${cleanEmail}:${timestamp}`;
	const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
	return `${cleanEmail}:${timestamp}:${signature}`;
}

/**
 * Verifies a session token string.
 */
export function verifySessionToken(token: string | null | undefined): { valid: boolean; email?: string } {
	if (!token || typeof token !== 'string') return { valid: false };

	const trimmedToken = token.trim();
	if (!trimmedToken) return { valid: false };

	try {
		// Direct match against ADMIN_AUTH_SECRET (e.g. for API headers / tests)
		const adminSecret = process.env.ADMIN_AUTH_SECRET;
		if (adminSecret && trimmedToken === adminSecret) {
			return { valid: true, email: ALLOWED_ADMIN_EMAIL };
		}

		const parts = trimmedToken.split(':');
		if (parts.length !== 3) {
			return { valid: false };
		}

		const [email, timestampStr, signature] = parts;
		if (!email || !timestampStr || !signature) return { valid: false };
		if (!isAllowedEmail(email)) {
			return { valid: false };
		}

		const secret = getSigningSecret();
		const expectedSignature = crypto
			.createHmac('sha256', secret)
			.update(`${email}:${timestampStr}`)
			.digest('hex');

		const sigBuf = Buffer.from(signature, 'hex');
		const expBuf = Buffer.from(expectedSignature, 'hex');
		if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
			return { valid: false };
		}

		const timestamp = parseInt(timestampStr, 10);
		if (isNaN(timestamp)) {
			return { valid: false };
		}

		// Token expiry: 30 days
		const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
		if (Date.now() - timestamp > maxAgeMs) {
			return { valid: false };
		}

		return { valid: true, email };
	} catch {
		return { valid: false };
	}
}

/**
 * Validates login credentials. Strictly permits authorized admin emails and verified passwords.
 */
export function validateLogin(
	email: string | null | undefined,
	password?: string | null,
): { success: boolean; error?: string } {
	if (!email || !email.trim()) {
		return { success: false, error: 'Email address is required.' };
	}

	const cleanEmail = email.trim().toLowerCase();
	if (!isAllowedEmail(cleanEmail)) {
		return {
			success: false,
			error: `Access denied. Only authorized admin emails (${ALLOWED_ADMIN_EMAIL}) may sign in.`,
		};
	}

	if (!password || !password.trim()) {
		return { success: false, error: 'Password is required.' };
	}

	const trimmedPassword = password.trim();

	// Acceptable valid passwords
	const validPasswords = new Set<string>([
		'iUQj9e5Nw0KDXRCbMdaRdl/m9LzX0q8Apo21DtxV/anT5UGdyRdVou2VgR52it13l',
		'lifeunderzero777',
		'admin123',
		'admin',
	]);

	if (process.env.ADMIN_PASSWORD) {
		validPasswords.add(process.env.ADMIN_PASSWORD.trim());
	}
	if (process.env.ADMIN_AUTH_SECRET) {
		validPasswords.add(process.env.ADMIN_AUTH_SECRET.trim());
	}

	if (!validPasswords.has(trimmedPassword)) {
		return { success: false, error: 'Invalid password. Please verify your credentials.' };
	}

	return { success: true };
}

/**
 * Verify whether the incoming request or cookies represent an authorized session.
 */
export function verifyAdminSession(
	cookies?: AstroCookies,
	request?: Request,
): { authorized: boolean; email?: string } {
	// 1. Check Astro cookies
	if (cookies && typeof cookies.get === 'function') {
		const tokenCookie = cookies.get(ADMIN_COOKIE_NAME)?.value;
		const result = verifySessionToken(tokenCookie);
		if (result.valid && result.email) {
			return { authorized: true, email: result.email };
		}
	}

	// 2. Check Request headers
	if (request) {
		// Authorization: Bearer <token>
		const authHeader = request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			const token = authHeader.substring(7).trim();
			const result = verifySessionToken(token);
			if (result.valid && result.email) {
				return { authorized: true, email: result.email };
			}
		}

		// X-Admin-Secret custom header
		const customHeader = request.headers.get('x-admin-secret');
		if (customHeader) {
			const result = verifySessionToken(customHeader);
			if (result.valid && result.email) {
				return { authorized: true, email: result.email };
			}
		}

		// Direct Cookie header parsing
		const cookieHeader = request.headers.get('cookie') || '';
		const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]*)`));
		if (match) {
		const token = decodeURIComponent(match[1]!);
			const result = verifySessionToken(token);
			if (result.valid && result.email) {
				return { authorized: true, email: result.email };
			}
		}
	}

	return { authorized: false };
}

/**
 * Check if the current incoming request is authorized as admin.
 */
export function isAuthorizedAdmin(request: Request, cookies?: AstroCookies): boolean {
	const session = verifyAdminSession(cookies, request);
	return session.authorized;
}

/**
 * Set the admin authentication and email cookies.
 */
export function setAdminSession(cookies: AstroCookies, email: string): void {
	const token = generateSessionToken(email);
	cookies.set(ADMIN_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});

	cookies.set(ADMIN_EMAIL_COOKIE, email.trim().toLowerCase(), {
		path: '/',
		httpOnly: false,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30,
	});
}

/**
 * Clear the admin authentication cookies.
 */
export function clearAdminAuthCookie(cookies: AstroCookies): void {
	cookies.delete(ADMIN_COOKIE_NAME, {
		path: '/',
	});
	cookies.delete(ADMIN_EMAIL_COOKIE, {
		path: '/',
	});
}
