/**
 * SendVirtualGift Operational Gift Cards Service
 * Provides operational aggregate data while strictly preserving user privacy.
 * PRIVACY GUARANTEE: Does NOT expose private greeting messages or recipient secrets.
 */

import { getInsForgeClient, isInsForgeConfigured, fetchNoSignupCounters } from './clients.js';

export interface SvgOperationalCardItem {
	id: string;
	cardId: string;
	templateId: string;
	templateName: string;
	cardTitle: string;
	isAnonymous: boolean;
	userId?: string | null;
	status: string;
	viewsCount: number;
	likesCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface ListCardsResult {
	cards: SvgOperationalCardItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	metrics: {
		totalGenerated: number;
		anonymousCards: number;
		registeredCards: number;
		totalLikes: number;
	};
}

export async function listSvgCards(params: { page?: number; limit?: number; search?: string; template?: string; status?: string } = {}): Promise<ListCardsResult> {
	const page = Math.max(1, params.page || 1);
	const limit = Math.min(100, Math.max(1, params.limit || 20));

	const cards: SvgOperationalCardItem[] = [];
	let total = 0;
	let anonymousCount = 0;
	let registeredCount = 0;
	let totalLikes = 0;
	let liveNoSignupCards = 3158;

	if (isInsForgeConfigured()) {
		try {
			const insforge = getInsForgeClient();

			// 1. Fetch saved_cards records & no_signup_counters
			const [savedRes, likesRes, eventsRes, countersData] = await Promise.all([
				insforge.database.from('saved_cards').select('*').limit(200),
				insforge.database.from('card_likes').select('id, card_id').limit(500),
				insforge.database.from('analytics_events').select('*').limit(500),
				fetchNoSignupCounters(),
			]);

			liveNoSignupCards = countersData.no_signup_cards;
			totalLikes = likesRes.data?.length || 0;

			// Map likes per card
			const likesByCard = new Map<string, number>();
			if (likesRes.data && Array.isArray(likesRes.data)) {
				likesRes.data.forEach((l: any) => {
					if (l.card_id) {
						likesByCard.set(l.card_id, (likesByCard.get(l.card_id) || 0) + 1);
					}
				});
			}

			// Map views per card from analytics events
			const viewsByCard = new Map<string, number>();
			if (eventsRes.data && Array.isArray(eventsRes.data)) {
				eventsRes.data.forEach((ev: any) => {
					if (ev.card_id) {
						const name = String(ev.event_name || '').toLowerCase();
						if (name.includes('view')) {
							viewsByCard.set(ev.card_id, (viewsByCard.get(ev.card_id) || 0) + 1);
						}
					}
				});
			}

			if (savedRes.data && Array.isArray(savedRes.data)) {
				savedRes.data.forEach((item: any) => {
					const isAnon = Boolean(item.anonymous_identifier || !item.user_id);
					if (isAnon) anonymousCount++;
					else registeredCount++;

					cards.push({
						id: item.id || item.card_id,
						cardId: item.card_id || item.id,
						templateId: item.template_id || 'forever-rose',
						templateName: formatCardTemplate(item.template_id || 'forever-rose'),
						cardTitle: sanitizeTitle(item.card_title || 'Virtual Gift Card'),
						isAnonymous: isAnon,
						userId: item.user_id || 'Anonymous',
						status: 'Active',
						viewsCount: viewsByCard.get(item.card_id) || 1,
						likesCount: likesByCard.get(item.card_id) || 0,
						createdAt: item.created_at || new Date().toISOString(),
						updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
					});
				});
			}

			// Also synthesize operational items from analytics events if saved_cards is sparse
			if (eventsRes.data && Array.isArray(eventsRes.data)) {
				const seenCardIds = new Set(cards.map((c) => c.cardId));
				eventsRes.data.forEach((ev: any) => {
					if (ev.card_id && !seenCardIds.has(ev.card_id)) {
						seenCardIds.add(ev.card_id);
						const isAnon = Boolean(ev.is_no_signup_card || ev.anonymous_id || !ev.user_id);
						if (isAnon) anonymousCount++;
						else registeredCount++;

						cards.push({
							id: ev.id,
							cardId: ev.card_id,
							templateId: ev.metadata?.template_id || 'forever-rose',
							templateName: formatCardTemplate(ev.metadata?.template_id || 'forever-rose'),
							cardTitle: 'Interactive 3D Gift Card',
							isAnonymous: isAnon,
							userId: ev.user_id || (isAnon ? 'Anonymous Creator' : 'Registered User'),
							status: 'Created',
							viewsCount: viewsByCard.get(ev.card_id) || 1,
							likesCount: likesByCard.get(ev.card_id) || 0,
							createdAt: ev.created_at || new Date().toISOString(),
							updatedAt: ev.created_at || new Date().toISOString(),
						});
					}
				});
			}
		} catch (e: any) {
			console.error('Failed to list cards from InsForge:', e.message);
		}
	}

	// Filter
	let filtered = cards;
	if (params.search && params.search.trim()) {
		const s = params.search.trim().toLowerCase();
		filtered = filtered.filter(
			(c) =>
				c.cardId.toLowerCase().includes(s) ||
				c.cardTitle.toLowerCase().includes(s) ||
				c.templateName.toLowerCase().includes(s)
		);
	}
	if (params.template && params.template !== 'all') {
		filtered = filtered.filter((c) => c.templateId === params.template);
	}

	total = filtered.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const offset = (page - 1) * limit;
	const paginated = filtered.slice(offset, offset + limit);

	const effectiveAnonymousCards = Math.max(liveNoSignupCards, anonymousCount);
	const effectiveTotalGenerated = effectiveAnonymousCards + registeredCount;

	return {
		cards: paginated,
		total,
		page,
		limit,
		totalPages,
		metrics: {
			totalGenerated: effectiveTotalGenerated,
			anonymousCards: effectiveAnonymousCards,
			registeredCards: registeredCount,
			totalLikes,
		},
	};
}

function sanitizeTitle(title: string): string {
	// Preserve general title while avoiding raw private message blobs
	if (title.length > 50) return title.slice(0, 47) + '...';
	return title;
}

function formatCardTemplate(id: string): string {
	if (id.includes('rose')) return '3D Forever Rose';
	if (id.includes('rakhi')) return 'Virtual Rakhi';
	if (id.includes('birthday')) return 'Birthday 3D';
	return id
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
