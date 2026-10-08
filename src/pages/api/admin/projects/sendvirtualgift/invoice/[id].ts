import type { APIRoute } from 'astro';
import { getSvgInvoiceById } from '../../../../../../projects/sendvirtualgift/services/invoices.js';
import { verifyAdminSession } from '../../../../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ params, request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Invoice ID is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const invoice = await getSvgInvoiceById(id);
		if (!invoice) {
			return new Response(JSON.stringify({ error: 'Invoice not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return new Response(JSON.stringify({ success: true, invoice }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
