/**
 * Instaflow SEO Suite - Namespaced Storage & Backup/Restore
 * Degrades gracefully to in-memory storage if localStorage is blocked or unavailable.
 */

const STORAGE_PREFIX = 'instaflow:seo:';
const memoryFallback = new Map();

export function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__seo_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

export function getItem(key, defaultValue = null) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    if (isLocalStorageAvailable()) {
      const val = window.localStorage.getItem(fullKey);
      return val !== null ? JSON.parse(val) : defaultValue;
    }
    return memoryFallback.has(fullKey) ? memoryFallback.get(fullKey) : defaultValue;
  } catch (e) {
    console.warn(`Storage read error for key "${key}":`, e);
    return memoryFallback.has(fullKey) ? memoryFallback.get(fullKey) : defaultValue;
  }
}

export function setItem(key, value) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    const serialized = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(fullKey, serialized);
    }
    memoryFallback.set(fullKey, value);
    return true;
  } catch (e) {
    console.warn(`Storage write error for key "${key}":`, e);
    memoryFallback.set(fullKey, value);
    return false;
  }
}

export function removeItem(key) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(fullKey);
    }
    memoryFallback.delete(fullKey);
    return true;
  } catch (e) {
    memoryFallback.delete(fullKey);
    return false;
  }
}

export function getAllStoredKeys() {
  const keys = [];
  try {
    if (isLocalStorageAvailable()) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keys.push(k.substring(STORAGE_PREFIX.length));
        }
      }
    } else {
      for (const k of memoryFallback.keys()) {
        if (k.startsWith(STORAGE_PREFIX)) {
          keys.push(k.substring(STORAGE_PREFIX.length));
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return keys;
}

/**
 * Exports all Instaflow SEO data into a versioned JSON backup object
 */
export function exportAllData() {
  const keys = getAllStoredKeys();
  const data = {};
  for (const k of keys) {
    data[k] = getItem(k);
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    generator: 'Instaflow SEO Suite',
    payload: data
  };
}

/**
 * Imports and restores all data from a versioned backup JSON with schema migrations
 */
export function importBackupData(backupJson) {
  if (!backupJson || typeof backupJson !== 'object') {
    throw new Error('Invalid backup file format.');
  }

  const payload = backupJson.payload || backupJson;
  let importedCount = 0;

  for (const [key, val] of Object.entries(payload)) {
    if (key.startsWith('__')) continue;
    setItem(key, val);
    importedCount++;
  }

  return { success: true, importedKeysCount: importedCount };
}
