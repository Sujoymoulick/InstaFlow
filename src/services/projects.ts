import { getDb, schema } from '../db/index.js';
import { desc, eq, and, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Project, NewProject } from '../db/schema.js';

export const VALID_PROJECT_STATUSES = [
	'Planning',
	'In Development',
	'Testing',
	'Published',
	'On Hold',
	'Completed',
	'Archived',
] as const;

export type ProjectStatus = (typeof VALID_PROJECT_STATUSES)[number];

export interface ProjectMetrics {
	total: number;
	published: number;
	inDevelopment: number;
	planning: number;
	onHold: number;
	completed: number;
	testing: number;
	archived: number;
	draft: number;
	recentProjects: Project[];
}

export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/&/g, '-and-') // Replace & with 'and'
		.replace(/[^\w-]+/g, '') // Remove all non-word chars
		.replace(/--+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

export async function getProjects(filters?: {
	status?: string;
	category?: string;
	search?: string;
}): Promise<Project[]> {
	const db = getDb();
	if (!db) return [];

	try {
		const conditions: (SQL | undefined)[] = [];

		if (filters?.status && filters.status !== 'All') {
			conditions.push(eq(schema.projects.status, filters.status));
		}

		if (filters?.category && filters.category !== 'All') {
			conditions.push(eq(schema.projects.category, filters.category));
		}

		if (filters?.search && filters.search.trim()) {
			const term = `%${filters.search.trim()}%`;
			conditions.push(
				or(
					ilike(schema.projects.name, term),
					ilike(schema.projects.description, term),
					ilike(schema.projects.category, term),
				),
			);
		}

		let query = db
			.select()
			.from(schema.projects)
			.orderBy(desc(schema.projects.updatedAt));

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		return await query;
	} catch (error) {
		console.error('Error fetching projects from DB:', error);
		return [];
	}
}

export async function getProjectById(id: string): Promise<Project | null> {
	const db = getDb();
	if (!db || !id) return null;

	try {
		const rows = await db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, id))
			.limit(1);

		return rows[0] || null;
	} catch (error) {
		console.error('Error fetching project by ID:', error);
		return null;
	}
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
	const db = getDb();
	if (!db || !slug) return null;

	try {
		const rows = await db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.slug, slug))
			.limit(1);

		return rows[0] || null;
	} catch (error) {
		console.error('Error fetching project by slug:', error);
		return null;
	}
}

export async function createProject(input: {
	name: string;
	slug?: string;
	description?: string | null;
	category?: string | null;
	status?: string | null;
	logoUrl?: string | null;
	liveUrl?: string | null;
	githubUrl?: string | null;
	technologies?: string[] | string | null;
}): Promise<Project> {
	const db = getDb();
	if (!db) {
		throw new Error('Database connection is not available');
	}

	const trimmedName = input.name.trim();
	if (!trimmedName) {
		throw new Error('Project name is required');
	}

	// Determine base slug
	let targetSlug = input.slug ? slugify(input.slug) : slugify(trimmedName);
	if (!targetSlug) {
		targetSlug = `project-${Date.now()}`;
	}

	// Ensure unique slug
	let uniqueSlug = targetSlug;
	let counter = 1;
	while (true) {
		const existing = await db
			.select({ id: schema.projects.id })
			.from(schema.projects)
			.where(eq(schema.projects.slug, uniqueSlug))
			.limit(1);

		if (existing.length === 0) {
			break;
		}
		uniqueSlug = `${targetSlug}-${counter}`;
		counter++;
	}

	// Normalize status
	let status = input.status?.trim() || 'Planning';
	if (!VALID_PROJECT_STATUSES.includes(status as any)) {
		status = 'Planning';
	}

	// Normalize technologies
	let technologies: string[] = [];
	if (Array.isArray(input.technologies)) {
		technologies = input.technologies.map((t) => t.trim()).filter(Boolean);
	} else if (typeof input.technologies === 'string') {
		technologies = input.technologies
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const [created] = await db
		.insert(schema.projects)
		.values({
			name: trimmedName,
			slug: uniqueSlug,
			description: input.description?.trim() || null,
			category: input.category?.trim() || 'General',
			status,
			logoUrl: input.logoUrl?.trim() || null,
			liveUrl: input.liveUrl?.trim() || null,
			githubUrl: input.githubUrl?.trim() || null,
			technologies,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();

	return created;
}

export async function updateProject(
	id: string,
	input: {
		name?: string;
		slug?: string;
		description?: string | null;
		category?: string | null;
		status?: string | null;
		logoUrl?: string | null;
		liveUrl?: string | null;
		githubUrl?: string | null;
		technologies?: string[] | string | null;
	},
): Promise<Project> {
	const db = getDb();
	if (!db) {
		throw new Error('Database connection is not available');
	}

	const existing = await getProjectById(id);
	if (!existing) {
		throw new Error('Project not found');
	}

	const updates: Partial<NewProject> = {
		updatedAt: new Date(),
	};

	if (typeof input.name === 'string') {
		const trimmedName = input.name.trim();
		if (!trimmedName) throw new Error('Project name cannot be empty');
		updates.name = trimmedName;
	}

	if (typeof input.slug === 'string') {
		const cleanSlug = slugify(input.slug);
		if (cleanSlug && cleanSlug !== existing.slug) {
			// Check uniqueness
			const collision = await db
				.select({ id: schema.projects.id })
				.from(schema.projects)
				.where(and(eq(schema.projects.slug, cleanSlug), sql`${schema.projects.id} != ${id}`))
				.limit(1);

			if (collision.length > 0) {
				throw new Error(`Slug "${cleanSlug}" is already in use by another project.`);
			}
			updates.slug = cleanSlug;
		}
	}

	if (input.description !== undefined) {
		updates.description = input.description?.trim() || null;
	}

	if (input.category !== undefined) {
		updates.category = input.category?.trim() || 'General';
	}

	if (input.status !== undefined) {
		const s = input.status?.trim() || 'Planning';
		if (!VALID_PROJECT_STATUSES.includes(s as any)) {
			throw new Error(`Invalid status "${s}". Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`);
		}
		updates.status = s;
	}

	if (input.logoUrl !== undefined) {
		updates.logoUrl = input.logoUrl?.trim() || null;
	}

	if (input.liveUrl !== undefined) {
		updates.liveUrl = input.liveUrl?.trim() || null;
	}

	if (input.githubUrl !== undefined) {
		updates.githubUrl = input.githubUrl?.trim() || null;
	}

	if (input.technologies !== undefined) {
		if (Array.isArray(input.technologies)) {
			updates.technologies = input.technologies.map((t) => t.trim()).filter(Boolean);
		} else if (typeof input.technologies === 'string') {
			updates.technologies = input.technologies
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
		} else {
			updates.technologies = [];
		}
	}

	const [updated] = await db
		.update(schema.projects)
		.set(updates)
		.where(eq(schema.projects.id, id))
		.returning();

	return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
	const db = getDb();
	if (!db) {
		throw new Error('Database connection is not available');
	}

	const result = await db.delete(schema.projects).where(eq(schema.projects.id, id)).returning({ id: schema.projects.id });
	return result.length > 0;
}

export async function getProjectMetrics(): Promise<ProjectMetrics> {
	const emptyMetrics: ProjectMetrics = {
		total: 0,
		published: 0,
		inDevelopment: 0,
		planning: 0,
		onHold: 0,
		completed: 0,
		testing: 0,
		archived: 0,
		draft: 0,
		recentProjects: [],
	};

	const db = getDb();
	if (!db) return emptyMetrics;

	try {
		const allProjects = await db
			.select()
			.from(schema.projects)
			.orderBy(desc(schema.projects.updatedAt));

		const metrics: ProjectMetrics = {
			total: allProjects.length,
			published: 0,
			inDevelopment: 0,
			planning: 0,
			onHold: 0,
			completed: 0,
			testing: 0,
			archived: 0,
			draft: 0,
			recentProjects: allProjects.slice(0, 5),
		};

		for (const p of allProjects) {
			const s = (p.status || '').toLowerCase();
			if (s === 'published') {
				metrics.published++;
			} else if (s === 'in development') {
				metrics.inDevelopment++;
			} else if (s === 'planning') {
				metrics.planning++;
				metrics.draft++;
			} else if (s === 'on hold') {
				metrics.onHold++;
			} else if (s === 'completed') {
				metrics.completed++;
			} else if (s === 'testing') {
				metrics.testing++;
				metrics.draft++;
			} else if (s === 'archived') {
				metrics.archived++;
			}
		}

		return metrics;
	} catch (error) {
		console.error('Error calculating project metrics from DB:', error);
		return emptyMetrics;
	}
}
