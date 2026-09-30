// NOTE: This is where you could wire up your own data providers:
// GraphQL, Databases, REST APIs, CDNs, proxies, S3, Matrix, IPFS, you name it…

import { API_URL, REMOTE_ASSETS_BASE_URL } from '../app/constants.js';
import type { Endpoint, EndpointsToOperations } from '../types/entities.js';

import * as operations from '../services/index.js';

export async function fetchData<Selected extends Endpoint>(endpoint: Selected) {
	const apiEndpoint = `${API_URL}${endpoint}`;

	try {
		const res = await fetch(apiEndpoint);
		if (res.ok) {
			return (await res.json()) as unknown as ReturnType<EndpointsToOperations[Selected]>;
		}
	} catch (e) {
		// Fallback to local service operations if fetch cannot connect (e.g. during build/SSR)
	}

	if (endpoint === 'products') {
		return operations.getProducts() as unknown as ReturnType<EndpointsToOperations[Selected]>;
	}
	if (endpoint === 'users') {
		return operations.getUsers() as unknown as ReturnType<EndpointsToOperations[Selected]>;
	}

	throw Error(`Invalid API data for endpoint: ${endpoint}`);
}

// NOTE: These helpers are useful for unifying paths, app-wide
export function url(path = '') {
	if (!path || path === '/') return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

// TODO: Remove old local assets from git history (to make cloning snappier).
export function asset(path: string) {
	// NOTE: Fetching remote assets from the Hugo admin dashboard Vercel dist.
	return `${REMOTE_ASSETS_BASE_URL}/${path}`;
}
