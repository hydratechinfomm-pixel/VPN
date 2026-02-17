const ConfigGenerator = require('../ConfigGenerator');

describe('ConfigGenerator.normalizeVmessClientConfig / generateVmess', () => {
  const originalHost = 'vm7558.bit.hosting';
  const publicHost = 'mingalarpar.news';
  const baseObj = {
    v: '2',
    ps: 'test-user',
    add: originalHost,
    port: '443',
    id: '0000-1111-2222-3333',
    aid: '0',
    net: 'tcp',
    type: 'none',
    host: '',
    path: '',
    tls: 'tls',
  };

  const vmessB64 = Buffer.from(JSON.stringify(baseObj)).toString('base64');
  const vmessUrl = `vmess://${vmessB64}`;

  test('normalizeVmessClientConfig replaces add/host in vmess:// URL', () => {
    const server = { v2ray: { publicHost } };
    const out = ConfigGenerator.normalizeVmessClientConfig(vmessUrl, server);
    expect(out.startsWith('vmess://')).toBe(true);

    const parsed = JSON.parse(Buffer.from(out.replace(/^vmess:\/\//, ''), 'base64').toString('utf8'));
    expect(parsed.add).toBe(publicHost);
    expect(parsed.host).toBe(publicHost);
    // other fields should be preserved
    expect(parsed.id).toBe(baseObj.id);
    expect(parsed.port).toBe(baseObj.port);
  });

  test('normalizeVmessClientConfig accepts raw JSON and returns vmess:// with replaced host', () => {
    const server = { v2ray: { publicHost } };
    const rawJson = JSON.stringify(baseObj);
    const out = ConfigGenerator.normalizeVmessClientConfig(rawJson, server);
    expect(out.startsWith('vmess://')).toBe(true);

    const parsed = JSON.parse(Buffer.from(out.replace(/^vmess:\/\//, ''), 'base64').toString('utf8'));
    expect(parsed.add).toBe(publicHost);
    expect(parsed.host).toBe(publicHost);
  });

  test('generateVmess normalizes existing device.configFile when publicHost present', () => {
    const device = { configFile: vmessUrl };
    const server = { v2ray: { publicHost } };
    const out = ConfigGenerator.generateVmess(device, server);
    const parsed = JSON.parse(Buffer.from(out.replace(/^vmess:\/\//, ''), 'base64').toString('utf8'));
    expect(parsed.add).toBe(publicHost);
    expect(parsed.host).toBe(publicHost);
  });

  test('generateVmess fallback uses server.v2ray.publicHost when constructing vmess', () => {
    const device = { _id: 'device-1', name: 'dev1' };
    const server = { v2ray: { publicHost }, host: '1.2.3.4', port: 443 };
    const out = ConfigGenerator.generateVmess(device, server);
    const parsed = JSON.parse(Buffer.from(out.replace(/^vmess:\/\//, ''), 'base64').toString('utf8'));
    expect(parsed.add).toBe(publicHost);
    // port should be string
    expect(parsed.port).toBe(String(server.port || '443'));
  });
});
