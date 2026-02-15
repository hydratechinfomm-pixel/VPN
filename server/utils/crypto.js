const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended 12 bytes

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  // Ensure 32 bytes
  return Buffer.from(key.padEnd(32).slice(0, 32));
}

function encryptString(plain) {
  const key = getKey();
  if (!key) {
    console.warn('ENCRYPTION_KEY not set — storing secret as plain text');
    return plain;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptString(ciphertext) {
  const key = getKey();
  if (!key) {
    // If key not present, assume value is stored plaintext
    return ciphertext;
  }

  try {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Failed to decrypt secret:', err.message);
    return ciphertext; // return as-is if decryption fails
  }
}

module.exports = {
  encryptString,
  decryptString,
};
