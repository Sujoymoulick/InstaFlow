import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		console.error('ERROR: DATABASE_URL environment variable is not defined.');
		process.exit(1);
	}

	console.log('Connecting to Neon PostgreSQL database...');
	const sql = neon(dbUrl);

	const drizzleDir = path.resolve(__dirname, '../../drizzle');
	const sqlFiles = fs
		.readdirSync(drizzleDir)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	if (sqlFiles.length === 0) {
		console.log('No migration SQL files found in drizzle directory.');
		return;
	}

	await sql.query(`
		CREATE TABLE IF NOT EXISTS "_migrations" (
			"name" VARCHAR(255) PRIMARY KEY,
			"applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`);

	// Check if automation_rules already existed prior to _migrations tracking
	const checkExisting = await sql.query(`
		SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_rules'
	`);
	if (checkExisting.length > 0) {
		await sql.query(`
			INSERT INTO "_migrations" ("name") VALUES ('0000_spooky_bedlam.sql') ON CONFLICT ("name") DO NOTHING
		`);
	}

	const appliedRows = await sql.query(`SELECT "name" FROM "_migrations"`);
	const appliedSet = new Set(appliedRows.map((r) => r.name));

	for (const file of sqlFiles) {
		if (appliedSet.has(file)) {
			console.log(`Skipping already applied migration: ${file}`);
			continue;
		}

		const filePath = path.join(drizzleDir, file);
		console.log(`Executing migration file: ${file}...`);
		const sqlContent = fs.readFileSync(filePath, 'utf8');

		// Split on statement breakpoint or semicolon
		const statements = sqlContent
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);

		for (const statement of statements) {
			if (statement) {
				await sql.query(statement);
			}
		}

		await sql.query(`INSERT INTO "_migrations" ("name") VALUES ($1)`, [file]);
		console.log(`Successfully applied: ${file}`);
	}

	console.log('All database migrations completed successfully! 🚀');
}

runMigration().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
