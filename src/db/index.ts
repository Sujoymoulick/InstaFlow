import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
	if (!connectionString) {
		return null;
	}

	if (!dbInstance) {
		const client = neon(connectionString);
		dbInstance = drizzle(client, { schema });
	}

	return dbInstance;
}

export { schema };
