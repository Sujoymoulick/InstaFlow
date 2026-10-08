import fs from 'node:fs';
import path from 'node:path';

function getTargetRuntime() {
	if (process.env.VERCEL_SERVERLESS_RUNTIME) {
		return process.env.VERCEL_SERVERLESS_RUNTIME;
	}
	const major = parseInt(process.versions.node.split('.')[0], 10);
	if (major >= 22) {
		return 'nodejs22.x';
	}
	return 'nodejs20.x';
}

function fixRuntime(dir, targetRuntime) {
	if (!fs.existsSync(dir)) return;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			fixRuntime(fullPath, targetRuntime);
		} else if (entry.name === '.vc-config.json') {
			try {
				const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
				if (content.runtime !== targetRuntime) {
					const oldRuntime = content.runtime;
					content.runtime = targetRuntime;
					fs.writeFileSync(fullPath, JSON.stringify(content, null, '\t') + '\n', 'utf8');
					console.log(`[fix-vercel-runtime] Updated ${fullPath} runtime from ${oldRuntime} to ${targetRuntime}`);
				}
			} catch (e) {
				console.error(`[fix-vercel-runtime] Error updating ${fullPath}:`, e);
			}
		}
	}
}

const targetRuntime = getTargetRuntime();
const functionsDir = path.join(process.cwd(), '.vercel', 'output', 'functions');
fixRuntime(functionsDir, targetRuntime);

