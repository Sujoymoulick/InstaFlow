import fs from 'node:fs';
import path from 'node:path';

function fixRuntime(dir) {
	if (!fs.existsSync(dir)) return;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			fixRuntime(fullPath);
		} else if (entry.name === '.vc-config.json') {
			try {
				const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
				if (content.runtime === 'nodejs18.x' || content.runtime?.startsWith('nodejs1')) {
					content.runtime = 'nodejs20.x';
					fs.writeFileSync(fullPath, JSON.stringify(content, null, '\t') + '\n', 'utf8');
					console.log(`[fix-vercel-runtime] Updated ${fullPath} runtime to nodejs20.x`);
				}
			} catch (e) {
				console.error(`[fix-vercel-runtime] Error updating ${fullPath}:`, e);
			}
		}
	}
}

const functionsDir = path.join(process.cwd(), '.vercel', 'output', 'functions');
fixRuntime(functionsDir);
