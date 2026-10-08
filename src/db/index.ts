import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';
import { getEnv } from '../lib/env.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	const connectionString =
		getEnv('INSTAFLOW_DATABASE_URL') ||
		getEnv('DATABASE_URL') ||
		getEnv('DATABASE_URL_UNPOOLED');

	if (!connectionString) {
		return null;
	}

	if (!dbInstance) {
		try {
			const client = neon(connectionString);
			dbInstance = drizzle(client, { schema });
		} catch (err) {
			console.warn('[InstaFlow DB] Neon client initialization warning:', err);
			return null;
		}
	}

	return dbInstance;
}

export { schema };
