const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

// Test with the ENCRYPTION_KEY from .env
const encryptionKey = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUA';
const key = Buffer.from(encryptionKey.padEnd(32).slice(0, 32));

console.log('Encryption Key:', encryptionKey);
console.log('Key length:', encryptionKey.length);
console.log('Key bytes:', key);
console.log('---');

// The encrypted token from database (without ENC: prefix)
const encryptedToken = 'BY0Gvxq0Mz6e/OXENZ3numdden+NsLGKJ1S4Y94rbqcx/r/7BXVr91DhG17qxt0gysS9NWv+rk+Zjl3GvSxvIwZ4fZasF+rflfsAa+efeHgZgBTE/p+4+oUk9WM=';

// Expected plain token
const expectedPlain = '139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4';

console.log('Attempting to decrypt...');
console.log('Encrypted token:', encryptedToken);
console.log('Expected plain:', expectedPlain);
console.log('---');

try {
  const data = Buffer.from(encryptedToken, 'base64');
  console.log('Data buffer length:', data.length);
  console.log('Data hex:', data.toString('hex'));
  
  const iv = data.slice(0, IV_LENGTH);
  const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = data.slice(IV_LENGTH + 16);
  
  console.log('IV:', iv.toString('hex'));
  console.log('AuthTag:', authTag.toString('hex'));
  console.log('Encrypted data:', encrypted.toString('hex'));
  console.log('---');
  
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const decryptedStr = decrypted.toString('utf8');
  
  console.log('Decrypted result:', decryptedStr);
  console.log('Expected result:', expectedPlain);
  console.log('Match:', decryptedStr === expectedPlain ? '✅ YES' : '❌ NO');
  
} catch (err) {
  console.error('Decryption failed:', err.message);
  console.error('Error details:', err);
}
