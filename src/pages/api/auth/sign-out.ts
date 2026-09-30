import type { APIRoute } from 'astro';
import { clearAdminAuthCookie } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ cookies, redirect }) => {
	clearAdminAuthCookie(cookies);
	return redirect('/authentication/sign-in?logged_out=1', 302);
};

export const post: APIRoute = async ({ cookies, redirect }) => {
	clearAdminAuthCookie(cookies);
	return redirect('/authentication/sign-in?logged_out=1', 302);
};

export const GET = get;
export const POST = post;
