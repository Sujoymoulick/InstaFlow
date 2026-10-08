/**
 * Strong TypeScript definitions for SendVirtualGift project integration
 */

export interface NeonRoseOrder {
	id: string;
	user_id: string;
	product_slug: string;
	amount: number; // in paise, e.g. 9900 = ₹99.00
	currency: string;
	payment_gateway: string;
	gateway_order_id?: string | null;
	gateway_payment_id?: string | null;
	gateway_signature?: string | null;
	order_status:
		| 'pending'
		| 'payment_initiated'
		| 'payment_verification_pending'
		| 'paid'
		| 'failed'
		| 'cancelled'
		| 'refund_pending'
		| 'refunded'
		| 'reconciliation_required';
	payment_status: 'unpaid' | 'authorized' | 'captured' | 'failed' | 'refunded';
	created_at: string;
	updated_at: string;
	paid_at?: string | null;
	gift_token?: string | null;
	receipt_number?: string | null;
	customization_data?: Record<string, any> | null;
	metadata?: Record<string, any> | null;
}

export interface NeonRoseEntitlement {
	id: string;
	user_id: string;
	product_slug: string;
	order_id: string;
	granted_at: string;
	entitlement_status: 'active' | 'revoked' | 'refunded';
}

export interface NeonRosePaymentEvent {
	id: string;
	gateway_event_id: string;
	gateway_payment_id?: string | null;
	event_type: string;
	processing_status: 'received' | 'processed' | 'ignored' | 'failed';
	received_at: string;
	processed_at?: string | null;
	error_message?: string | null;
	raw_payload?: Record<string, any> | null;
}

export interface NeonRoseCardBackup {
	id: string;
	card_id: string;
	user_id: string;
	order_id?: string | null;
	template_id: string;
	card_title: string;
	card_url: string;
	thumbnail_url?: string | null;
	card_data: Record<string, any>;
	backup_status: 'active' | 'archived' | 'deleted';
	created_at: string;
	updated_at: string;
	receipt_number?: string | null;
	order_status?: string | null;
	paid_at?: string | null;
}

export interface SanitizedClerkUser {
	id: string;
	name: string;
	firstName: string | null;
	lastName: string | null;
	username: string | null;
	email: string;
	emailAddresses: string[];
	imageUrl: string;
	createdAt: number;
	lastSignInAt: number | null;
	lastActiveAt: number | null;
	banned: boolean;
	locked: boolean;
	status: 'Active' | 'Banned' | 'Locked';
	twoFactorEnabled: boolean;
	phoneNumbers: string[];
	externalAccounts: Array<{ provider: string; emailAddress?: string }>;
}

export interface UserRelationalStats {
	cardsCreated: number;
	savedCards: number;
	likesCount: number;
	sharesCount: number;
	paidOrdersCount: number;
	totalSpentRupees: number;
	lastActiveAt?: string | null;
}

export interface CombinedAdminUser extends SanitizedClerkUser {
	stats: UserRelationalStats;
	insforgeRecord?: {
		id: string;
		role?: string;
		avatarUrl?: string;
		createdAt?: string;
	} | null;
}

export interface SvgOverviewKpis {
	totalRegisteredUsers: number;
	totalAnonymousUsers: number;
	totalCardsGenerated: number;
	totalAnonymousCards: number;
	totalAuthUserCards: number;
	totalCardViews: number;
	totalShares: number;
	totalCardLikes: number;
	totalPaidPurchases: number;
	successfulPayments: number;
	failedPayments: number;
	pendingPayments: number;
	totalRevenueRupees: number;
	activeRateLimitEvents: number;
	neonStatus: 'connected' | 'degraded' | 'disconnected';
	insforgeStatus: 'connected' | 'degraded' | 'disconnected';
	clerkStatus: 'connected' | 'degraded' | 'disconnected';
	razorpayStatus: 'connected' | 'degraded' | 'disconnected';
	cloudinaryStatus: 'connected' | 'degraded' | 'disconnected';
	lastUpdated: string;
}

export interface RateLimitSettingItem {
	key: string;
	name: string;
	description: string;
	limit: number;
	windowSeconds: number;
	unit: string;
	enabled: boolean;
}

export interface IntegrationStatusDetail {
	id: string;
	name: string;
	service: string;
	status: 'connected' | 'degraded' | 'disconnected' | 'unverified';
	latencyMs: number;
	lastChecked: string;
	version?: string;
	environmentRef: string;
	details: Record<string, any>;
	error?: string;
}

export interface InvoiceRecord {
	id: string;
	receiptNumber: string;
	orderId: string;
	paymentId: string;
	customerName: string;
	customerEmail: string;
	productName: string;
	productSlug: string;
	subtotal: number;
	tax: number;
	total: number;
	currency: string;
	status: 'paid' | 'pending' | 'failed' | 'refunded';
	createdAt: string;
	paidAt: string;
	downloadUrl?: string;
}
