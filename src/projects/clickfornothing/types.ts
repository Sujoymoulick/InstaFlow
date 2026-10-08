export type SubmissionStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Published';

export interface ClickForNothingSubmission {
	id: string;
	userId: string;
	userEmail: string | null;
	userName: string | null;
	userAvatarUrl: string | null;
	title: string;
	description: string | null;
	url: string;
	previewImageUrl: string | null;
	category: string;
	tags: string[];
	status: SubmissionStatus;
	rejectionReason: string | null;
	reviewedBy: string | null;
	reviewedAt: string | null;
	publishedAt: string | null;
	metadata: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface SubmissionStats {
	totalUsers: number;
	totalSubmissions: number;
	pendingReview: number;
	approved: number;
	rejected: number;
	published: number;
}

export interface SubmissionFilterOptions {
	search?: string;
	status?: string;
	dateRange?: 'all' | 'today' | '7d' | '30d';
	category?: string;
	sort?: 'newest' | 'oldest' | 'title_asc' | 'title_desc';
	page?: number;
	limit?: number;
}

export interface SubmissionListResult {
	submissions: ClickForNothingSubmission[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface ClickForNothingUser {
	userId: string;
	name: string;
	email: string;
	avatarUrl?: string | null;
	verified: boolean;
	totalSubmissions: number;
	pendingCount: number;
	approvedCount: number;
	publishedCount: number;
	rejectedCount: number;
	firstSubmittedAt?: string | null;
	lastSubmittedAt?: string | null;
}

export interface SubmissionAuditLogEntry {
	id: string;
	submissionId: string | null;
	adminEmail: string;
	action: string;
	previousStatus: string | null;
	newStatus: string | null;
	details: string | null;
	createdAt: string;
}
