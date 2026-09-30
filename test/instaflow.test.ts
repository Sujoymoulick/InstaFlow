import assert from 'node:assert';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { normalizeText, matchesRule } from '../src/services/automation-engine.js';
import { encryptToken, decryptToken, verifyWebhookSignature, generateOAuthState } from '../src/lib/crypto.js';
import {
	isAllowedEmail,
	validateLogin,
	generateSessionToken,
	verifySessionToken,
	ALLOWED_ADMIN_EMAIL,
} from '../src/lib/auth.js';
import crypto from 'node:crypto';

console.log('🧪 Starting InstaFlow Core Verification Tests...\n');

// 1. Keyword Normalization Tests
console.log('1. Testing Keyword & Text Normalization:');
assert.strictEqual(normalizeText('  HELLO World!  '), 'hello world');
assert.strictEqual(normalizeText('Price??? Details please...'), 'price details please');
assert.strictEqual(normalizeText('LINK-ME: now!'), 'link me now');
console.log('  ✓ normalizeText passes case, punctuation, and whitespace tests');

// 2. Keyword Match Mode Tests
console.log('\n2. Testing Rule Keyword Matching Logic:');

// Test A: Exact Match Mode
const exactMatch = matchesRule('price', 'price, pricing, cost', 'exact');
assert.strictEqual(exactMatch.matched, true);
assert.strictEqual(exactMatch.matchedKeyword, 'price');

const exactFail = matchesRule('what is the price?', 'price, pricing, cost', 'exact');
assert.strictEqual(exactFail.matched, false, 'Exact match should not match substrings');
console.log('  ✓ Exact match mode validates strictly');

// Test B: Contains Match Mode
const containsMatch = matchesRule('Hey there, could you send the pricing link?', 'pricing, info', 'contains');
assert.strictEqual(containsMatch.matched, true);
assert.strictEqual(containsMatch.matchedKeyword, 'pricing');

const containsPunctuationMatch = matchesRule('Discount!!!', 'discount, sale', 'contains');
assert.strictEqual(containsPunctuationMatch.matched, true);
assert.strictEqual(containsPunctuationMatch.matchedKeyword, 'discount');

const containsFail = matchesRule('Just saying hello!', 'price, link, discount', 'contains');
assert.strictEqual(containsFail.matched, false);
console.log('  ✓ Contains match mode handles substrings and punctuation accurately');

// Test C: JSON-formatted keywords
const jsonKws = JSON.stringify(['promo', 'code', 'coupon']);
const jsonMatch = matchesRule('Do you have a promo?', jsonKws, 'contains');
assert.strictEqual(jsonMatch.matched, true);
assert.strictEqual(jsonMatch.matchedKeyword, 'promo');
console.log('  ✓ JSON array keyword parsing works');

// 3. Token Encryption & Decryption (AES-256-GCM)
console.log('\n3. Testing AES-256-GCM Sensitive Token Encryption at Rest:');
process.env.INSTAGRAM_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-12345';
const sampleToken = 'IGAAZADSampleAccessTokenStringForMetaInstagramBusinessAccount_987654321';
const encrypted = encryptToken(sampleToken);

assert.notStrictEqual(encrypted, sampleToken, 'Encrypted token must not be plaintext');
assert.strictEqual(encrypted.split(':').length, 3, 'Encrypted format must be iv:tag:ciphertext');

const decrypted = decryptToken(encrypted);
assert.strictEqual(decrypted, sampleToken, 'Decrypted token must match original plaintext');
console.log('  ✓ Symmetric encryption and decryption round-trip succeeds');

// 4. Webhook Signature Verification
console.log('\n4. Testing Instagram Webhook HMAC-SHA256 Signature Verification:');
const testSecret = 'meta_app_secret_super_secret_test';
const payload = JSON.stringify({ object: 'instagram', entry: [{ id: '123' }] });

const validHmac = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');
const validHeader = `sha256=${validHmac}`;

assert.strictEqual(
	verifyWebhookSignature(payload, validHeader, testSecret),
	true,
	'Valid signature must verify successfully'
);

const invalidHeader = `sha256=invalid_hash_that_should_fail_verification_000000000000000000000000`;
assert.strictEqual(
	verifyWebhookSignature(payload, invalidHeader, testSecret),
	false,
	'Invalid signature must be rejected'
);

const tamperedPayload = JSON.stringify({ object: 'instagram', entry: [{ id: '999' }] });
assert.strictEqual(
	verifyWebhookSignature(tamperedPayload, validHeader, testSecret),
	false,
	'Tampered payload must be rejected'
);
console.log('  ✓ HMAC-SHA256 signature verification validates correctly and rejects tampering');

// 5. OAuth State Generation
console.log('\n5. Testing OAuth CSRF State Generation:');
const state1 = generateOAuthState();
const state2 = generateOAuthState();
assert.strictEqual(typeof state1, 'string');
assert.strictEqual(state1.length, 64, 'State should be a 32-byte (64 hex char) random string');
assert.notStrictEqual(state1, state2, 'Consecutive states must be unique');
console.log('  ✓ Cryptographically random OAuth states generated successfully');

// 6. Login Flow & Email Restriction Tests
console.log('\n6. Testing Login Flow & Single-Email Restriction (lifeunderzero777@gmail.com):');
assert.strictEqual(ALLOWED_ADMIN_EMAIL, 'lifeunderzero777@gmail.com');

// Test A: isAllowedEmail check
assert.strictEqual(isAllowedEmail('lifeunderzero777@gmail.com'), true, 'Exact email must be allowed');
assert.strictEqual(isAllowedEmail('LIFEUNDERZERO777@GMAIL.COM'), true, 'Case-insensitive email must be allowed');
assert.strictEqual(isAllowedEmail(' lifeunderzero777@gmail.com '), true, 'Trimmed email must be allowed');
assert.strictEqual(isAllowedEmail('other@gmail.com'), false, 'Non-admin email must be rejected');
assert.strictEqual(isAllowedEmail('admin@instaflow.app'), false, 'Arbitrary email must be rejected');
assert.strictEqual(isAllowedEmail(''), false, 'Empty email must be rejected');
assert.strictEqual(isAllowedEmail(null), false, 'Null email must be rejected');
console.log('  ✓ isAllowedEmail strictly matches only lifeunderzero777@gmail.com');

// Test B: validateLogin with unauthorized emails
const unauthorizedLogin = validateLogin('hacker@example.com', 'password123');
assert.strictEqual(unauthorizedLogin.success, false, 'Unauthorized email must fail login');
assert.ok(
	unauthorizedLogin.error?.includes('lifeunderzero777@gmail.com'),
	'Error message must state that only lifeunderzero777@gmail.com is authorized',
);

const emptyEmailLogin = validateLogin('', 'password123');
assert.strictEqual(emptyEmailLogin.success, false, 'Empty email must fail login');

// Test C: validateLogin with authorized email
const testPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_AUTH_SECRET || 'validpassword123';
const authorizedLogin = validateLogin('lifeunderzero777@gmail.com', testPassword);
assert.strictEqual(authorizedLogin.success, true, 'Authorized email must pass validation');

// Test D: Cryptographic Session Token Generation & Verification
const token = generateSessionToken('lifeunderzero777@gmail.com');
assert.strictEqual(typeof token, 'string');
const verification = verifySessionToken(token);
assert.strictEqual(verification.valid, true, 'Valid token must verify');
assert.strictEqual(verification.email, 'lifeunderzero777@gmail.com');

// Test E: Rejecting forged / unauthorized tokens
const forgedToken = token.replace('lifeunderzero777@gmail.com', 'attacker@fake.com');
assert.strictEqual(verifySessionToken(forgedToken).valid, false, 'Tampered token must fail');

const garbageToken = 'invalid:token:format';
assert.strictEqual(verifySessionToken(garbageToken).valid, false, 'Garbage token must fail');
console.log('  ✓ Session token cryptography and email binding validated');

// Test F: HTTP Request Authorization via Cookie & Headers
const validRequest = new Request('http://localhost:2121/dashboard', {
	headers: {
		cookie: `instaflow_admin_token=${token}`,
	},
});
const { isAuthorizedAdmin } = await import('../src/lib/auth.js');
assert.strictEqual(isAuthorizedAdmin(validRequest), true, 'Request with valid lifeunderzero777@gmail.com token must be authorized');

const invalidRequest = new Request('http://localhost:2121/dashboard', {
	headers: {
		cookie: `instaflow_admin_token=${forgedToken}`,
	},
});
assert.strictEqual(isAuthorizedAdmin(invalidRequest), false, 'Request with unauthorized email token must be rejected');

const unauthenticatedRequest = new Request('http://localhost:2121/dashboard');
assert.strictEqual(isAuthorizedAdmin(unauthenticatedRequest), false, 'Request with no credentials must be rejected');
// 7. Project Tracker Validation & Operations Tests
console.log('\n7. Testing Personal Projects Overview & Validation Logic:');
const { slugify, VALID_PROJECT_STATUSES, getProjects, getProjectMetrics, createProject, updateProject, deleteProject } = await import('../src/services/projects.js');

// Test A: Slugify utility
assert.strictEqual(slugify('InstaFlow SaaS App'), 'instaflow-saas-app');
assert.strictEqual(slugify('My Super & Cool Tool!!!'), 'my-super-and-cool-tool');
assert.strictEqual(slugify('  Spaced  Out  Name  '), 'spaced-out-name');
console.log('  ✓ slugify generates clean, URL-safe slugs');

// Test B: Project Status validation
assert.strictEqual(VALID_PROJECT_STATUSES.length, 7);
assert.ok(VALID_PROJECT_STATUSES.includes('Planning'));
assert.ok(VALID_PROJECT_STATUSES.includes('In Development'));
assert.ok(VALID_PROJECT_STATUSES.includes('Testing'));
assert.ok(VALID_PROJECT_STATUSES.includes('Published'));
assert.ok(VALID_PROJECT_STATUSES.includes('On Hold'));
assert.ok(VALID_PROJECT_STATUSES.includes('Completed'));
assert.ok(VALID_PROJECT_STATUSES.includes('Archived'));
console.log('  ✓ All 7 required project statuses supported');

// Test C: Project API Authentication Guard
const { post: createProjectApi, get: getProjectsApi } = await import('../src/pages/api/projects/index.js');
const unauthApiReq = new Request('http://localhost:2121/api/projects', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ name: 'Unauthorized Project' }),
});
const unauthRes = await createProjectApi({ request: unauthApiReq, cookies: {} as any } as any);
assert.strictEqual(unauthRes.status, 401, 'Unauthorized request to create project must return 401');
console.log('  ✓ POST /api/projects strictly enforces admin authentication');

// Test D: Project API Validation (Empty name)
const authApiReqEmptyName = new Request('http://localhost:2121/api/projects', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		cookie: `instaflow_admin_token=${token}`,
	},
	body: JSON.stringify({ name: '   ' }),
});
const emptyNameRes = await createProjectApi({ request: authApiReqEmptyName, cookies: {} as any } as any);
assert.strictEqual(emptyNameRes.status, 400, 'Empty project name must return 400 validation error');
console.log('  ✓ POST /api/projects rejects missing or blank project name');

// Test E: Project API Validation (Invalid status)
const authApiReqInvalidStatus = new Request('http://localhost:2121/api/projects', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		cookie: `instaflow_admin_token=${token}`,
	},
	body: JSON.stringify({ name: 'My Tool', status: 'InvalidStatusXYZ' }),
});
const invalidStatusRes = await createProjectApi({ request: authApiReqInvalidStatus, cookies: {} as any } as any);
assert.strictEqual(invalidStatusRes.status, 400, 'Invalid status must return 400');
console.log('  ✓ POST /api/projects validates status against allowed list');

// 8. Database Integration Tests (if DATABASE_URL available)
if (process.env.DATABASE_URL) {
	console.log('\n8. Testing Neon PostgreSQL Project CRUD Lifecycle:');
	const testProjectName = `Test Project ${Date.now()}`;
	const createdProj = await createProject({
		name: testProjectName,
		category: 'SaaS',
		status: 'In Development',
		description: 'Automated test project for dashboard verification',
		technologies: ['TypeScript', 'Astro', 'Neon'],
		liveUrl: 'https://example.com',
		githubUrl: 'https://github.com/example/test-project',
	});

	assert.ok(createdProj.id, 'Created project must have UUID id');
	assert.strictEqual(createdProj.name, testProjectName);
	assert.strictEqual(createdProj.status, 'In Development');
	assert.ok(createdProj.slug.startsWith('test-project'));
	console.log('  ✓ Project created and persisted in Neon DB');

	// Verify metrics update
	const metricsAfterCreate = await getProjectMetrics();
	assert.ok(metricsAfterCreate.total >= 1);
	assert.ok(metricsAfterCreate.inDevelopment >= 1);
	console.log(`  ✓ Dashboard metrics dynamically updated (Total: ${metricsAfterCreate.total}, In Dev: ${metricsAfterCreate.inDevelopment})`);

	// Update project
	const { put: updateProjectApi, del: deleteProjectApi } = await import('../src/pages/api/projects/[id]/index.js');
	const updateReq = new Request(`http://localhost:2121/api/projects/${createdProj.id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			cookie: `instaflow_admin_token=${token}`,
		},
		body: JSON.stringify({ status: 'Published', name: `${testProjectName} (Updated)` }),
	});
	const updateRes = await updateProjectApi({ params: { id: createdProj.id }, request: updateReq, cookies: {} as any } as any);
	assert.strictEqual(updateRes.status, 200, 'Project update must return 200');
	const updatedJson = await updateRes.json();
	assert.strictEqual(updatedJson.project.status, 'Published');
	console.log('  ✓ Project updated to Published status via API');

	// Clean up by deleting test project
	const deleteReq = new Request(`http://localhost:2121/api/projects/${createdProj.id}`, {
		method: 'DELETE',
		headers: {
			cookie: `instaflow_admin_token=${token}`,
		},
	});
	const deleteRes = await deleteProjectApi({ params: { id: createdProj.id }, request: deleteReq, cookies: {} as any } as any);
	assert.strictEqual(deleteRes.status, 200, 'Project deletion must return 200');
	console.log('  ✓ Project deleted with cleanup confirmed');
}

console.log('\n🎉 ALL INSTAFLOW & PROJECT TRACKER TESTS PASSED SUCCESSFULLY! ✅\n');
