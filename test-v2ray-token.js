// Load environment variables
require('dotenv').config();

const { decryptString } = require('./server/utils/crypto');

const encryptedToken = 'BY0Gvxq0Mz6e/OXENZ3numdden+NsLGKJ1S4Y94rbqcx/r/7BXVr91DhG17qxt0gysS9NWv+rk+Zjl3GvSxvIwZ4fZasF+rflfsAa+efeHgZgBTE/p+4+oUk9WM=';

console.log('ENCRYPTION_KEY from env:', process.env.ENCRYPTION_KEY);
console.log('---');

// Test the decryptString function from crypto.js
const fullToken = `ENC:${encryptedToken}`;
const decrypted = decryptString(encryptedToken);

console.log('Encrypted token:', fullToken);
console.log('Decrypted token:', decrypted);
console.log('Expected token:', '139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4');
console.log('Match:', decrypted === '139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4' ? '✅ YES' : '❌ NO');

// Now test with the actual V2rayService logic
const testServer = {
  host: '114.29.236.236',
  port: 10000,
  v2ray: {
    apiBaseUrl: 'https://114.29.236.236:443',
    apiPort: 443,
    apiToken: fullToken, // This is what comes from database - with ENC: prefix
    accessMethod: 'api'
  }
};

console.log('---');
console.log('Testing V2rayService token handling:');
console.log('Raw token from DB:', testServer.v2ray.apiToken);

const rawToken = testServer.v2ray.apiToken || null;
const apiToken = rawToken && typeof rawToken === 'string' && rawToken.startsWith('ENC:')
  ? decryptString(rawToken.replace(/^ENC:/, ''))
  : rawToken;

console.log('After V2rayService processing:');
console.log('API Token:', apiToken);
console.log('Expected:', '139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4');
console.log('Match:', apiToken === '139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4' ? '✅ YES' : '❌ NO');

// What would be sent as Authorization header
console.log('---');
console.log('Authorization header would be:');
console.log(`Bearer ${apiToken}`);
