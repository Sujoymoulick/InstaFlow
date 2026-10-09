/**
 * Central Project Registry for InstaFlow Admin Panel
 * Allows registering multiple web apps, SaaS products, and micro-services.
 */

export interface ProjectNavigationItem {
	id: string;
	label: string;
	path: string;
	icon: string;
	badge?: string;
}

export interface ProjectIntegrationConfig {
	id: string;
	name: string;
	type: 'database' | 'auth' | 'payments' | 'storage' | 'hosting' | 'email' | 'other';
	status: 'connected' | 'degraded' | 'disconnected' | 'unconfigured';
	isConfigured: boolean;
	description: string;
}

export interface RegisteredProject {
	id: string;
	name: string;
	slug: string;
	category: string;
	targetUrl: string;
	description: string;
	status: 'active' | 'maintenance' | 'development' | 'archived';
	badgeText?: string;
	badgeColor?: string;
	routePrefix: string;
	enabled: boolean;
	createdAt: string;
	icon: string;
	integrations: ProjectIntegrationConfig[];
	navigation: ProjectNavigationItem[];
}

export const PROJECT_REGISTRY: RegisteredProject[] = [
	{
		id: 'sendvirtualgift',
		name: 'SendVirtualGift',
		slug: 'sendvirtualgift',
		category: 'Virtual Gifting & Micro-SaaS',
		targetUrl: 'https://sendvirtualgift.com',
		description: 'Interactive 3D virtual gifts, greeting cards, and premium animated templates.',
		status: 'active',
		badgeText: 'Live Production',
		badgeColor: 'green',
		routePrefix: '/admin/projects/sendvirtualgift',
		enabled: true,
		createdAt: '2026-09-01T00:00:00.000Z',
		icon: 'gift',
		integrations: [
			{
				id: 'neon',
				name: 'Neon PostgreSQL',
				type: 'database',
				status: 'connected',
				isConfigured: true,
				description: 'Authoritative transactional database for paid rose templates, orders, entitlements & backups',
			},
			{
				id: 'insforge',
				name: 'InsForge PostgreSQL & BaaS',
				type: 'database',
				status: 'connected',
				isConfigured: true,
				description: 'Primary application BaaS for saved cards, likes, analytics events and user data',
			},
			{
				id: 'clerk',
				name: 'Clerk Authentication',
				type: 'auth',
				status: 'connected',
				isConfigured: true,
				description: 'Authoritative user identity and authentication provider',
			},
			{
				id: 'razorpay',
				name: 'Razorpay Payment Gateway',
				type: 'payments',
				status: 'connected',
				isConfigured: true,
				description: 'Payment gateway for INR 3D Forever Rose template purchases (₹99)',
			},
			{
				id: 'cloudinary',
				name: 'Cloudinary Media Storage',
				type: 'storage',
				status: 'connected',
				isConfigured: true,
				description: 'Optimized cloud asset storage and media transforms',
			},
		],
		navigation: [
			{ id: 'overview', label: 'Overview', path: '/admin/projects/sendvirtualgift/overview', icon: 'home' },
			{ id: 'users', label: 'Users', path: '/admin/projects/sendvirtualgift/users', icon: 'users' },
			{ id: 'analytics', label: 'Live Analytics', path: '/admin/projects/sendvirtualgift/analytics', icon: 'chart-bar' },
			{ id: 'cards', label: 'Gift Cards', path: '/admin/projects/sendvirtualgift/cards', icon: 'collection' },
			{ id: 'backups', label: 'Card Backup', path: '/admin/projects/sendvirtualgift/backups', icon: 'cloud-download' },
			{ id: 'payments', label: 'Payments', path: '/admin/projects/sendvirtualgift/payments', icon: 'credit-card' },
			{ id: 'transactions', label: 'Transactions', path: '/admin/projects/sendvirtualgift/transactions', icon: 'clipboard-list' },
			{ id: 'invoices', label: 'Invoices', path: '/admin/projects/sendvirtualgift/invoices', icon: 'document-text' },
			{ id: 'databases', label: 'Databases', path: '/admin/projects/sendvirtualgift/databases', icon: 'database' },
			{ id: 'map', label: 'Architecture Map', path: '/admin/projects/sendvirtualgift/map', icon: 'map' },
			{ id: 'rate-limits', label: 'Rate Limiting', path: '/admin/projects/sendvirtualgift/rate-limits', icon: 'shield-check' },
			{ id: 'integrations', label: 'Integrations', path: '/admin/projects/sendvirtualgift/integrations', icon: 'puzzle' },
			{ id: 'env', label: 'Environment Status', path: '/admin/projects/sendvirtualgift/env', icon: 'key' },
			{ id: 'health', label: 'System Health', path: '/admin/projects/sendvirtualgift/health', icon: 'heart' },
			{ id: 'settings', label: 'Settings', path: '/admin/projects/sendvirtualgift/settings', icon: 'cog' },
		],
	},
	{
		id: 'clickfornothing',
		name: 'ClickForNothing',
		slug: 'clickfornothing',
		category: 'Web Directory & Micro-Sites',
		targetUrl: 'https://clickfornothing.com',
		description: 'Curated platform and community submissions for interactive websites, web applications, and micro-tools.',
		status: 'active',
		badgeText: 'Production',
		badgeColor: 'indigo',
		routePrefix: '/admin/projects/clickfornothing',
		enabled: true,
		createdAt: '2026-10-01T00:00:00.000Z',
		icon: 'globe',
		integrations: [
			{
				id: 'neon',
				name: 'Neon PostgreSQL',
				type: 'database',
				status: 'connected',
				isConfigured: true,
				description: 'Authoritative transactional database for user website submissions, reviews, status logs & metadata',
			},
			{
				id: 'clerk',
				name: 'Clerk Authentication',
				type: 'auth',
				status: 'connected',
				isConfigured: true,
				description: 'Authoritative user identity provider and role-based administrative access control',
			},
			{
				id: 'cloudinary',
				name: 'Cloud Media Storage',
				type: 'storage',
				status: 'connected',
				isConfigured: true,
				description: 'Site screenshots, preview thumbnails, and user media assets',
			},
			{
				id: 'hosting',
				name: 'Production Domain',
				type: 'hosting',
				status: 'connected',
				isConfigured: true,
				description: 'Live visitor directory platform at https://clickfornothing.com',
			},
		],
		navigation: [
			{ id: 'overview', label: 'Overview', path: '/admin/projects/clickfornothing/overview', icon: 'home' },
			{ id: 'submissions', label: 'Submissions', path: '/admin/projects/clickfornothing/submissions', icon: 'collection' },
			{ id: 'pending-review', label: 'Pending Review', path: '/admin/projects/clickfornothing/pending-review', icon: 'clock' },
			{ id: 'published', label: 'Published', path: '/admin/projects/clickfornothing/published', icon: 'check-circle' },
			{ id: 'rejected', label: 'Rejected', path: '/admin/projects/clickfornothing/rejected', icon: 'x-circle' },
			{ id: 'users', label: 'Users', path: '/admin/projects/clickfornothing/users', icon: 'users' },
			{ id: 'analytics', label: 'Live Analytics', path: '/admin/projects/clickfornothing/analytics', icon: 'chart-bar' },
			{ id: 'databases', label: 'Databases', path: '/admin/projects/clickfornothing/databases', icon: 'database' },
			{ id: 'map', label: 'Architecture Map', path: '/admin/projects/clickfornothing/map', icon: 'map' },
			{ id: 'integrations', label: 'Integrations', path: '/admin/projects/clickfornothing/integrations', icon: 'puzzle' },
			{ id: 'env', label: 'Environment Status', path: '/admin/projects/clickfornothing/env', icon: 'key' },
			{ id: 'health', label: 'System Health', path: '/admin/projects/clickfornothing/health', icon: 'heart' },
		],
	},
];

export function getRegisteredProjects(): RegisteredProject[] {
	return PROJECT_REGISTRY.filter((p) => p.enabled);
}

export function getProjectById(id: string): RegisteredProject | undefined {
	return PROJECT_REGISTRY.find((p) => p.id === id || p.slug === id);
}
