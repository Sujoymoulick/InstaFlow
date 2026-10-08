/**
 * Universal Environment Variable Reader
 * Works seamlessly across Node.js, Vercel Serverless runtime, Astro SSR, and client bundles.
 */

export function getEnv(key: string, defaultValue = ''): string {
	// 1. Check Node.js process.env (Server / SSR / Vercel Serverless)
	if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
		const val = String(process.env[key]).trim();
		if (val.length > 0) return val;
	}

	// 2. Check Astro / Vite import.meta.env
	try {
		if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key] !== undefined) {
			const val = String((import.meta as any).env[key]).trim();
			if (val.length > 0) return val;
		}
	} catch {}

	return defaultValue;
}
