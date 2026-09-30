import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
	const keyStr = process.env.INSTAGRAM_ENCRYPTION_KEY;
	if (!keyStr || keyStr.length < 32) {
		throw new Error('INSTAGRAM_ENCRYPTION_KEY must be configured with at least 32 characters');
	}
	// Derive 32-byte key using sha256 to ensure exactly 256 bits
	return crypto.createHash('sha256').update(keyStr).digest();
}

/**
 * Encrypt a plaintext token using AES-256-GCM authenticated encryption.
 * Output format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptToken(plaintext: string): string {
	if (!plaintext) return '';
	const key = getEncryptionKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	let encrypted = cipher.update(plaintext, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag().toString('hex');
	return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a token previously encrypted with encryptToken.
 */
export function decryptToken(encryptedString: string): string {
	if (!encryptedString) return '';
	try {
		const parts = encryptedString.split(':');
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted token format');
		}

		const [ivHex, authTagHex, cipherHex] = parts;
		if (!ivHex || !authTagHex || cipherHex === undefined) throw new Error('Invalid encrypted token format');
		const key = getEncryptionKey();
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch {
		throw new Error('Failed to decrypt sensitive credential');
	}
}

/**
 * Validate Instagram Webhook X-Hub-Signature-256 header.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyWebhookSignature(
	rawBody: string | Buffer,
	signatureHeader: string | null | undefined,
	appSecret?: string,
): boolean {
	const secret = appSecret || process.env.META_APP_SECRET;
	if (!secret || !signatureHeader) {
		return false;
	}

	const parts = signatureHeader.split('=');
	if (parts.length !== 2 || parts[0] !== 'sha256') {
		return false;
	}

	const expectedSignatureHex = parts[1];
	if (!expectedSignatureHex) return false;
	const expectedBuffer = Buffer.from(expectedSignatureHex, 'hex');

	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(rawBody);
	const calculatedBuffer = hmac.digest();

	if (expectedBuffer.length !== calculatedBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}

/**
 * Generate a cryptographically secure random state string for OAuth.
 */
export function generateOAuthState(): string {
	return crypto.randomBytes(32).toString('hex');
}
